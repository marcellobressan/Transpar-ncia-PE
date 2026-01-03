# Color Palettes & Themes

Distinctive color approaches that avoid generic AI aesthetics.

## Aesthetic-Driven Palettes

### Midnight Editorial
```css
:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --text-primary: #f5f5f7;
  --text-muted: #8b8b9a;
  --accent: #ff6b35;
  --accent-subtle: #ff6b3520;
}
```

### Warm Minimalist
```css
:root {
  --bg-primary: #faf8f5;
  --bg-secondary: #f0ebe3;
  --text-primary: #1a1a1a;
  --text-muted: #6b6b6b;
  --accent: #c9a227;
  --accent-subtle: #c9a22715;
}
```

### Neo Brutalist
```css
:root {
  --bg-primary: #fffef5;
  --bg-secondary: #000000;
  --text-primary: #000000;
  --border: #000000;
  --accent: #ff5722;
  --shadow: 4px 4px 0 #000000;
}
```

### Soft Gradient
```css
:root {
  --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --bg-card: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.2);
}
```

### Forest/Natural
```css
:root {
  --bg-primary: #1a2f23;
  --bg-secondary: #243b2a;
  --text-primary: #e8f0e8;
  --text-muted: #8fa88f;
  --accent: #7cb342;
  --accent-warm: #d4a574;
}
```

### Retro Tech
```css
:root {
  --bg-primary: #0f1419;
  --bg-secondary: #1a2634;
  --text-primary: #00ff88;
  --text-muted: #4a6670;
  --accent: #00d4ff;
  --scanline: rgba(0, 255, 136, 0.03);
}
```

## Semantic Color Tokens

```css
:root {
  /* State Colors */
  --success: #22c55e;
  --success-bg: #22c55e15;
  --warning: #f59e0b;
  --warning-bg: #f59e0b15;
  --error: #ef4444;
  --error-bg: #ef444415;
  --info: #3b82f6;
  --info-bg: #3b82f615;
  
  /* Interactive States */
  --hover-overlay: rgba(255, 255, 255, 0.05);
  --active-overlay: rgba(255, 255, 255, 0.1);
  --focus-ring: var(--accent);
}
```

## Gradient Techniques

### Mesh Gradients
```css
.mesh-gradient {
  background: 
    radial-gradient(at 40% 20%, #ff6b35 0px, transparent 50%),
    radial-gradient(at 80% 0%, #764ba2 0px, transparent 50%),
    radial-gradient(at 0% 50%, #667eea 0px, transparent 50%),
    radial-gradient(at 80% 50%, #ff5722 0px, transparent 50%),
    radial-gradient(at 0% 100%, #764ba2 0px, transparent 50%);
  background-color: #0a0a0f;
}
```

### Aurora Effect
```css
.aurora {
  background: linear-gradient(
    125deg,
    #00ff88 0%,
    #00d4ff 25%,
    #764ba2 50%,
    #ff6b35 75%,
    #00ff88 100%
  );
  background-size: 400% 400%;
  animation: aurora 15s ease infinite;
}

@keyframes aurora {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

### Noise Texture Overlay
```css
.noise-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.05;
  pointer-events: none;
}
```

## Tailwind Custom Colors

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        midnight: {
          50: '#f5f5f7',
          100: '#e5e5e7',
          800: '#12121a',
          900: '#0a0a0f',
          950: '#050508',
        },
        accent: {
          DEFAULT: '#ff6b35',
          light: '#ff8c5a',
          dark: '#e55a28',
        },
      },
    },
  },
}
```

## Dark Mode Implementation

```css
/* System preference */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0a0a0f;
    --text-primary: #f5f5f7;
  }
}

/* Class-based toggle */
.dark {
  --bg-primary: #0a0a0f;
  --text-primary: #f5f5f7;
}

.light {
  --bg-primary: #faf8f5;
  --text-primary: #1a1a1a;
}
```
