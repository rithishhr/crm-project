import { motion, HTMLMotionProps } from 'framer-motion';
import React from 'react';

interface MotionProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  delay?: number;
}

export const FadeIn = ({ children, delay = 0, ...props }: MotionProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ 
      duration: 0.5, 
      delay,
      ease: [0.4, 0, 0.2, 1] 
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const ScaleIn = ({ children, delay = 0, ...props }: MotionProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ 
      type: "spring",
      stiffness: 100,
      damping: 15,
      delay 
    }}
    {...props}
  >
    {children}
  </motion.div>
);

export const StaggerContainer = ({ children, ...props }: MotionProps) => (
  <motion.div
    initial="hidden"
    animate="show"
    variants={{
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.1
        }
      }
    }}
    {...props}
  >
    {children}
  </motion.div>
);
