# Animation Patterns

High-impact animations that create memorable experiences.

## Page Load Animations

### Staggered Reveal
```css
.stagger-item {
  opacity: 0;
  transform: translateY(20px);
  animation: revealUp 0.6s ease forwards;
}

.stagger-item:nth-child(1) { animation-delay: 0.1s; }
.stagger-item:nth-child(2) { animation-delay: 0.2s; }
.stagger-item:nth-child(3) { animation-delay: 0.3s; }
.stagger-item:nth-child(4) { animation-delay: 0.4s; }

@keyframes revealUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Clip-Path Reveal
```css
.clip-reveal {
  clip-path: inset(0 100% 0 0);
  animation: clipReveal 1s ease forwards;
}

@keyframes clipReveal {
  to {
    clip-path: inset(0 0 0 0);
  }
}
```

### Scale + Fade
```css
.scale-fade-in {
  opacity: 0;
  transform: scale(0.95);
  animation: scaleFadeIn 0.5s ease forwards;
}

@keyframes scaleFadeIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

## Hover Effects

### Magnetic Button
```tsx
// React + Framer Motion
const MagneticButton = ({ children }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (clientX - left - width / 2) * 0.3;
    const y = (clientY - top - height / 2) * 0.3;
    setPosition({ x, y });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => setPosition({ x: 0, y: 0 })}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.button>
  );
};
```

### Glowing Border
```css
.glow-border {
  position: relative;
  background: var(--bg-card);
  border-radius: 12px;
}

.glow-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(45deg, #ff6b35, #764ba2, #00d4ff, #ff6b35);
  background-size: 300% 300%;
  border-radius: 14px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
  animation: gradient-rotate 3s linear infinite;
}

.glow-border:hover::before {
  opacity: 1;
}

@keyframes gradient-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### Underline Animation
```css
.animated-underline {
  position: relative;
}

.animated-underline::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.3s ease;
}

.animated-underline:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}
```

## Framer Motion Patterns

### Page Transitions
```tsx
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  enter: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: 0.3 }
  },
};

<motion.div
  initial="initial"
  animate="enter"
  exit="exit"
  variants={pageVariants}
>
  {children}
</motion.div>
```

### Staggered List
```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

<motion.ul variants={containerVariants} initial="hidden" animate="show">
  {items.map((item) => (
    <motion.li key={item.id} variants={itemVariants}>
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

### Scroll-Triggered Animation
```tsx
import { motion, useInView } from 'framer-motion';

const ScrollReveal = ({ children }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};
```

## Micro-Interactions

### Button Press
```css
.press-effect {
  transition: transform 0.1s ease;
}

.press-effect:active {
  transform: scale(0.97);
}
```

### Input Focus
```css
.input-focus {
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.input-focus:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-subtle);
}
```

### Checkbox Animation
```css
.checkbox-animated {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 4px;
  transition: all 0.2s ease;
  position: relative;
}

.checkbox-animated:checked {
  background: var(--accent);
  border-color: var(--accent);
}

.checkbox-animated:checked::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  animation: checkPop 0.2s ease;
}

@keyframes checkPop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

## Accessibility

```css
/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
