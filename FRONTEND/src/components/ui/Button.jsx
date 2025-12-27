import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-500',
  outline: 'border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white',
  ghost: 'text-primary-500 hover:bg-primary-500/10',
  gradient: 'bg-gradient-to-r from-primary-500 to-rose-400 text-white shadow-lg shadow-primary-500/30 hover:from-primary-400 hover:to-rose-300',
  danger: 'bg-red-500 text-white hover:bg-red-400',
};

const sizes = {
  md: 'px-5 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
};

export const Button = React.forwardRef(({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
  <motion.button
    ref={ref}
    whileTap={{ scale: 0.95 }}
    whileHover={{ translateY: -2 }}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 disabled:cursor-not-allowed disabled:opacity-60',
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  >
    {children}
  </motion.button>
));

Button.displayName = 'Button';
