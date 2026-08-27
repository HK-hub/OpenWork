import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva('ui-button', {
  variants: {
    variant: { default: 'ui-button-primary', secondary: 'ui-button-secondary', ghost: 'ui-button-ghost', danger: 'ui-button-danger' },
    size: { default: 'ui-button-md', sm: 'ui-button-sm', lg: 'ui-button-lg', icon: 'ui-button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
