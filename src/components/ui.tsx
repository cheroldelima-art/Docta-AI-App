import * as React from 'react';
import { useState, useRef, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon, AlertCircle } from 'lucide-react';

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', icon: Icon, children, asChild, ...props }, ref) => {
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 shadow-sm',
      outline: 'bg-transparent border border-slate-200 text-slate-700 hover:bg-slate-50',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
      link: 'bg-transparent text-blue-600 hover:underline p-0 h-auto',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    };

    const classes = cn(
      'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
      variants[variant],
      variant !== 'link' && sizes[size],
      className
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(classes, (children as React.ReactElement<any>).props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        className={classes}
        {...props}
      >
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// --- CARD ---
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-b border-slate-50', className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-slate-900', className)} {...props}>{children}</h3>;
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...props}>{children}</div>;
}

// --- INPUT ---
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

// --- BADGE ---
export function Badge({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'error' | 'secondary' | 'outline', className?: string }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    error: 'bg-red-50 text-red-700 border border-red-100',
    secondary: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    outline: 'bg-transparent border border-slate-200 text-slate-600',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

// --- DIALOG ---
export function Dialog({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={cn("bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}

// --- TABS ---
export const Tabs = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("", className)} {...props}>{children}</div>
);

export const TabsList = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500", className)} {...props}>{children}</div>
);

export const TabsTrigger = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm", className)} {...props}>{children}</button>
);

export const TabsContent = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2", className)} {...props}>{children}</div>
);

// --- CONFIRM DIALOG ---
export function ConfirmDialog({ 
  open, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = "Confirmer", 
  cancelText = "Annuler",
  variant = "danger"
}: { 
  open: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  description: string; 
  confirmText?: string; 
  cancelText?: string;
  variant?: "danger" | "primary"
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full", variant === "danger" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600")}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        </div>
        <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// --- POPOVER ---
export function Popover({ children, content, open, onOpenChange }: { children: React.ReactNode, content: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const actualOpen = open !== undefined ? open : internalOpen;
  
  const setActualOpen = (val: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (val) {
      if (open === undefined) setInternalOpen(true);
      if (onOpenChange) onOpenChange(true);
    } else {
      timeoutRef.current = setTimeout(() => {
        if (open === undefined) setInternalOpen(false);
        if (onOpenChange) onOpenChange(false);
      }, 150); // Small delay to prevent flickering
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActualOpen(false);
      }
    };
    if (actualOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [actualOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div 
        onMouseEnter={() => setActualOpen(true)}
        onMouseLeave={() => setActualOpen(false)}
        onClick={() => setActualOpen(!actualOpen)}
        className="cursor-pointer"
      >
        {children}
      </div>
      <AnimatePresence>
        {actualOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onMouseEnter={() => setActualOpen(true)}
            onMouseLeave={() => setActualOpen(false)}
            className="absolute z-[100] mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 origin-top-left"
          >
            {/* Arrow */}
            <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45" />
            <div className="relative z-10">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
