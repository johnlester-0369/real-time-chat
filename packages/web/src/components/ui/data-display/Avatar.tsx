import React, { useState, createContext, useContext } from 'react'
import { cn } from '@/utils/cn.util'
import { forwardRefWithAs } from '@/utils/polymorphic.util'
import { User } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AvatarVariant = 'solid' | 'subtle' | 'outline'
export type AvatarShape = 'circle' | 'square' | 'rounded'
export type AvatarColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'

// ============================================================================
// Context
// ============================================================================

type AvatarContextValue = {
  size: AvatarSize
  variant: AvatarVariant
  shape: AvatarShape
  color: AvatarColor
  name?: string
  imageLoaded: boolean
  imageError: boolean
  setImageLoaded: (v: boolean) => void
  setImageError: (v: boolean) => void
}

const AvatarContext = createContext<AvatarContextValue | null>(null)

function useAvatarContext() {
  const ctx = useContext(AvatarContext)
  if (!ctx)
    throw new Error('Avatar sub-components must be used within Avatar.Root')
  return ctx
}

// ============================================================================
// Style Maps
// ============================================================================

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-label-sm',
  md: 'h-10 w-10 text-label-md',
  lg: 'h-12 w-12 text-label-lg',
  xl: 'h-16 w-16 text-title-md',
  '2xl': 'h-20 w-20 text-title-lg',
}

const iconSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-10 w-10',
}

const shapeClasses: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-lg',
}

const solidColorClasses: Record<AvatarColor, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  tertiary: 'bg-tertiary text-on-tertiary',
  success: 'bg-success text-on-success',
  error: 'bg-error text-on-error',
  warning: 'bg-warning text-on-warning',
  info: 'bg-info text-on-info',
  neutral: 'bg-surface-container-high text-on-surface',
}

const subtleColorClasses: Record<AvatarColor, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  success: 'bg-success-container text-on-success-container',
  error: 'bg-error-container text-on-error-container',
  warning: 'bg-warning-container text-on-warning-container',
  info: 'bg-info-container text-on-info-container',
  neutral: 'bg-surface-container text-on-surface-variant',
}

const outlineColorClasses: Record<AvatarColor, string> = {
  primary: 'border-2 border-primary text-primary bg-transparent',
  secondary: 'border-2 border-secondary text-secondary bg-transparent',
  tertiary: 'border-2 border-tertiary text-tertiary bg-transparent',
  success: 'border-2 border-success text-success bg-transparent',
  error: 'border-2 border-error text-error bg-transparent',
  warning: 'border-2 border-warning text-warning bg-transparent',
  info: 'border-2 border-info text-info bg-transparent',
  neutral: 'border-2 border-outline text-on-surface bg-transparent',
}

// ============================================================================
// Utility
// ============================================================================

function getInitials(name?: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// ============================================================================
// Root Component
// ============================================================================

export type AvatarRootOwnProps = {
  size?: AvatarSize
  variant?: AvatarVariant
  shape?: AvatarShape
  color?: AvatarColor
  name?: string
}

const AvatarRoot = forwardRefWithAs<'div', AvatarRootOwnProps>((props, ref) => {
  const {
    as,
    size = 'md',
    variant = 'subtle',
    shape = 'circle',
    color = 'primary',
    name,
    className,
    children,
    ...rest
  } = props

  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const Component = as || 'div'

  const variantMap = {
    solid: solidColorClasses,
    subtle: subtleColorClasses,
    outline: outlineColorClasses,
  }
  const colorClasses = variantMap[variant][color]

  return (
    <AvatarContext.Provider
      value={{
        size,
        variant,
        shape,
        color,
        name,
        imageLoaded,
        imageError,
        setImageLoaded,
        setImageError,
      }}
    >
      <Component
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden flex-shrink-0 select-none font-semibold',
          sizeClasses[size],
          shapeClasses[shape],
          colorClasses,
          className,
        )}
        {...rest}
      >
        {children}
      </Component>
    </AvatarContext.Provider>
  )
})

AvatarRoot.displayName = 'Avatar.Root'

// ============================================================================
// Image Component
// ============================================================================

export type AvatarImageOwnProps = {
  src?: string
  alt?: string
}

const AvatarImage = forwardRefWithAs<'img', AvatarImageOwnProps>(
  (props, ref) => {
    const { as, src, alt, className, ...rest } = props
    const { shape, setImageLoaded, setImageError, imageError } =
      useAvatarContext()
    const Component = as || 'img'

    if (!src || imageError) return null

    return (
      <Component
        ref={ref}
        src={src}
        alt={alt || ''}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        className={cn(
          'absolute inset-0 h-full w-full object-cover',
          shapeClasses[shape],
          className,
        )}
        {...rest}
      />
    )
  },
)

AvatarImage.displayName = 'Avatar.Image'

// ============================================================================
// Fallback Component
// ============================================================================

export type AvatarFallbackOwnProps = object

const AvatarFallback = forwardRefWithAs<'span', AvatarFallbackOwnProps>(
  (props, ref) => {
    const { as, className, children, ...rest } = props
    const { name, size, imageLoaded } = useAvatarContext()
    const Component = as || 'span'

    if (imageLoaded) return null

    const initials = getInitials(name)

    return (
      <Component
        ref={ref}
        className={cn('flex items-center justify-center', className)}
        aria-label={name}
        {...rest}
      >
        {children || initials || <User className={iconSizeClasses[size]} />}
      </Component>
    )
  },
)

AvatarFallback.displayName = 'Avatar.Fallback'

// ============================================================================
// Group Component
// ============================================================================

export type AvatarGroupOwnProps = {
  max?: number
  spacing?: string
}

const AvatarGroup = forwardRefWithAs<'div', AvatarGroupOwnProps>(
  (props, ref) => {
    const { as, spacing, className, children, ...rest } = props
    const Component = as || 'div'

    return (
      <Component
        ref={ref}
        className={cn('flex items-center', className)}
        style={{ gap: spacing || '-0.5rem' }}
        {...rest}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            className="relative"
            style={{ marginLeft: index > 0 ? spacing || '-0.5rem' : 0 }}
          >
            {child}
          </div>
        ))}
      </Component>
    )
  },
)

AvatarGroup.displayName = 'Avatar.Group'

// ============================================================================
// Compound Export
// ============================================================================

const Avatar = {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
  Group: AvatarGroup,
}

export default Avatar