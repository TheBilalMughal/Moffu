import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../lib/cn';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none text-neutral-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-0.5 text-danger-DEFAULT" aria-hidden="true">
        *
      </span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
