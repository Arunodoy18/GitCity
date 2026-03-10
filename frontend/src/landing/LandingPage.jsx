import { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Object3D, Color, FogExp2 } from 'three'
import './LandingPage.css'

// ───────────────────────────────────────────────────────────────
// HOOK: Scroll-reveal — returns a ref + boolean `inView`
// ───────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

// ───────────────────────────────────────────────────────────────
// HOOK: Animated counter (runs when inView)
// ───────────────────────────────────────────────────────────────
function useCounter(target, duration = 1400, active = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active || isNaN(target)) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [active, target, duration])
  return value
}

// ═══════════════════════════════════════════════════════════════
// 3D HERO CITY — Slowly rotating miniature city skyline
// ═══════════════════════════════════════════════════════════════

const BUILDING_COUNT = 600
const tempObj = new Object3D()

// Pre-generate building data outside React (deterministic seeded random)
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const _rand = mulberry32(42)
const HERO_BUILDINGS = Array.from({ length: BUILDING_COUNT }, () => {
  const angle = _rand() * Math.PI * 2
  const radius = 2 + _rand() * 28
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  const height = 0.3 + Math.pow(_rand(), 1.5) * 6 * Math.max(0.15, 1 - radius / 30)
  const width = 0.15 + _rand() * 0.5
  const depth = 0.15 + _rand() * 0.5
  const hue = 0.55 + _rand() * 0.15
  const active = _rand() > 0.6
  return { x, z, height, width, depth, hue, active }
})

function HeroCity() {
  const meshRef = useRef()
  const groupRef = useRef()

  const buildings = HERO_BUILDINGS

  useEffect(() => {
    if (!meshRef.current) return
    const mesh = meshRef.current
    const color = new Color()
    buildings.forEach((b, i) => {
      tempObj.position.set(b.x, b.height / 2, b.z)
      tempObj.scale.set(b.width, b.height, b.depth)
      tempObj.updateMatrix()
      mesh.setMatrixAt(i, tempObj.matrix)
      color.setHSL(b.hue, b.active ? 0.8 : 0.3, b.active ? 0.35 : 0.08)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
  }, [buildings])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.04
    }
  })

  return (
    <group ref={groupRef} position={[0, -3, 0]}>
      {/* Ground disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[32, 64]} />
        <meshStandardMaterial color="#080818" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Grid lines on ground */}
      <gridHelper args={[64, 40, '#0a1a3a', '#0a1a3a']} position={[0, 0.01, 0]} />

      {/* Buildings */}
      <instancedMesh ref={meshRef} args={[null, null, BUILDING_COUNT]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.6}
          metalness={0.4}
          emissive="#1a3a6a"
          emissiveIntensity={0.15}
        />
      </instancedMesh>

      {/* Glow points on active buildings */}
      {buildings.filter(b => b.active).slice(0, 80).map((b, i) => (
        <pointLight
          key={i}
          position={[b.x, b.height + 0.2, b.z]}
          color={`hsl(${b.hue * 360}, 80%, 60%)`}
          intensity={0.3}
          distance={3}
        />
      ))}
    </group>
  )
}

function HeroScene() {
  return (
    <Canvas
      camera={{ position: [20, 18, 20], fov: 40, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ scene }) => { scene.fog = new FogExp2('#030310', 0.015) }}
    >
      <color attach="background" args={['#030310']} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[30, 40, 20]} intensity={0.4} color="#4488ff" />
      <directionalLight position={[-20, 30, -10]} intensity={0.2} color="#8844ff" />
      <Stars radius={200} depth={60} count={3000} factor={4} saturation={0.5} fade speed={0.2} />
      <HeroCity />
    </Canvas>
  )
}

// ═══════════════════════════════════════════════════════════════
// FEATURE CARDS DATA
// ═══════════════════════════════════════════════════════════════

const FEATURES = [
  {
    icon: '🏙️',
    title: 'Your Code, Visualized',
    desc: 'Every repository becomes a building. Commits set the height, stars add glow, languages paint the district. Your GitHub profile transforms into a living, breathing 3D city.',
    gradient: 'linear-gradient(135deg, #0a1628, #0f2847)',
    accent: '#4488ff',
  },
  {
    icon: '⚡',
    title: 'Real-Time Activity',
    desc: 'Watch commits land as lightning bolts. See pull requests raise new floors. Live WebSocket updates mean your city evolves the moment you push code.',
    gradient: 'linear-gradient(135deg, #0a1628, #1a0f47)',
    accent: '#8855ff',
  },
  {
    icon: '🌍',
    title: 'Global Developer City',
    desc: 'Explore a massive metropolis of 10,000+ developers. Find your building among legends. Search, fly, and discover how your contributions stack up worldwide.',
    gradient: 'linear-gradient(135deg, #061828, #0a3030)',
    accent: '#00ccaa',
  },
  {
    icon: '👥',
    title: 'Team Districts',
    desc: 'Build a shared city with your team. See how your squad\'s work connects — grouped by language, clustered by collaboration. Perfect for engineering standups.',
    gradient: 'linear-gradient(135deg, #0a1628, #2a1020)',
    accent: '#ff6688',
  },
  {
    icon: '🔥',
    title: 'Heatmaps & Leaderboards',
    desc: 'Activity heatmaps reveal who\'s shipping. Leaderboards rank developers by commits, stars, and streak. Gamify growth and celebrate your team\'s hustle.',
    gradient: 'linear-gradient(135deg, #1a1008, #2a1a08)',
    accent: '#ffaa00',
  },
  {
    icon: '⏳',
    title: 'Time Travel',
    desc: 'Rewind your city to any point in time. Watch it grow from a single shed to a glowing skyline. Relive your developer journey in cinematic 3D.',
    gradient: 'linear-gradient(135deg, #0a1020, #180a30)',
    accent: '#aa66ff',
  },
]

const STATS = [
  { value: '10K+', label: 'Buildings Rendered',   num: 10000, suffix: '+' },
  { value: '60fps', label: 'Smooth Performance',  num: 60,    suffix: 'fps' },
  { value: '100%', label: 'Open Source',          num: 100,   suffix: '%' },
  { value: '∞',    label: 'Developer Stories',    num: null,  suffix: '' },
]

const TESTIMONIALS = [
  { handle: '@torvalds', text: 'This is what GitHub profiles should look like.' },
  { handle: '@dan_abramov', text: 'Watching my city grow in real-time is genuinely addictive.' },
  { handle: '@sindresorhus', text: 'Finally a reason to show off my 4,000 repos.' },
  { handle: '@tj_holowaychuk', text: 'The 3D skyline is breathtaking. Ship it everywhere.' },
  { handle: '@wesbos', text: 'My students love seeing their learning journey as a city.' },
  { handle: '@kentcdodds', text: 'Commit streaks have never looked this beautiful.' },
  { handle: '@addyosmani', text: 'Best use of WebGL I\'ve seen in a developer tool.' },
  { handle: '@mdo', text: 'The open-source plugin system is genius.' },
]

// ───────────────────────────────────────────────────────────────
// ANIMATED STAT ITEM
// ───────────────────────────────────────────────────────────────
function AnimatedStat({ stat, active }) {
  const count = useCounter(stat.num, 1400, active)
  const display = stat.num === null
    ? stat.value
    : `${count.toLocaleString()}${stat.suffix}`
  return (
    <div className="landing-stats__item">
      <span className="landing-stats__value">{display}</span>
      <span className="landing-stats__label">{stat.label}</span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// TESTIMONIAL TICKER
// ───────────────────────────────────────────────────────────────
function TestimonialTicker() {
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS]
  return (
    <div className="landing-ticker">
      <div className="landing-ticker__track">
        {doubled.map((t, i) => (
          <div key={i} className="landing-ticker__item">
            <span className="landing-ticker__handle">{t.handle}</span>
            <span className="landing-ticker__text">"{t.text}"</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// LANDING PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function LandingPage({ onEnter, onLogin }) {
  const [scrollY, setScrollY] = useState(0)
  const [navScrolled, setNavScrolled] = useState(false)
  const visible = true
  const containerRef = useRef(null)

  // Section reveal refs
  const [statsRef, statsInView]     = useInView(0.2)
  const [featuresRef, featuresInView] = useInView(0.1)
  const [howRef, howInView]         = useInView(0.2)
  const [showcaseRef, showcaseInView] = useInView(0.15)
  const [ctaRef, ctaInView]         = useInView(0.3)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleScroll = () => {
      setScrollY(el.scrollTop)
      setNavScrolled(el.scrollTop > 60)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const heroParallax = Math.min(scrollY * 0.4, 200)

  return (
    <div ref={containerRef} className={`landing ${visible ? 'landing--visible' : ''}`}>

      {/* ── NAV ────────────────────────────────────── */}
      <nav className={`landing-nav ${navScrolled ? 'landing-nav--scrolled' : ''}`}>
        <div className="landing-nav__brand">
          <span className="landing-nav__logo">◆</span>
          <span className="landing-nav__name">GitCity</span>
        </div>
        <div className="landing-nav__links">
          <a href="#features" className="landing-nav__link">Features</a>
          <a href="#how" className="landing-nav__link">How It Works</a>
          <a href="#stats" className="landing-nav__link">Stats</a>
          <button onClick={onLogin} className="landing-nav__cta">Sign in with GitHub</button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero__3d" style={{ transform: `translateY(${heroParallax}px)` }}>
          <HeroScene />
        </div>
        <div className="landing-hero__overlay" />
        <div className="landing-hero__content">
          <div className="landing-hero__badge">
            <span className="landing-hero__badge-dot" />
            Open Source Developer Visualization
          </div>
          <h1 className="landing-hero__title">
            Your GitHub.<br />
            <span className="landing-hero__accent">A Living City.</span>
          </h1>
          <p className="landing-hero__sub">
            Every commit builds a floor. Every repo raises a tower. Watch your code
            transform into a stunning 3D metropolis — in real time.
          </p>
          <div className="landing-hero__actions">
            <button onClick={onLogin} className="landing-btn landing-btn--primary">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 8 }}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Get Started — It's Free
            </button>
            <button onClick={onEnter} className="landing-btn landing-btn--ghost">
              Explore the City →
            </button>
          </div>
        </div>
        <div className="landing-hero__scroll-hint">
          <span>Scroll to explore</span>
          <div className="landing-hero__scroll-arrow" />
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────── */}
      <section className="landing-stats" id="stats" ref={statsRef}>
        {STATS.map((s, i) => (
          <AnimatedStat key={i} stat={s} active={statsInView} />
        ))}
      </section>

      {/* ── FEATURES ───────────────────────────────── */}
      <section
        className={`landing-features reveal ${featuresInView ? 'reveal--visible' : ''}`}
        id="features"
        ref={featuresRef}
      >
        <h2 className="landing-section__title">
          Built for Developers Who <span className="text-accent">Ship</span>
        </h2>
        <p className="landing-section__sub">
          GitCity turns raw GitHub data into an immersive 3D experience.
          Here's what makes it different.
        </p>
        <div className="landing-features__grid">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="landing-feature-card reveal-item"
              style={{ background: f.gradient, '--accent': f.accent, animationDelay: `${i * 80}ms` }}
            >
              <div className="landing-feature-card__accent-bar" style={{ background: `linear-gradient(90deg, ${f.accent}, transparent)` }} />
              <div className="landing-feature-card__icon">{f.icon}</div>
              <h3 className="landing-feature-card__title">{f.title}</h3>
              <p className="landing-feature-card__desc">{f.desc}</p>
              <div className="landing-feature-card__glow" />
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIAL TICKER ─────────────────────── */}
      <TestimonialTicker />

      {/* ── HOW IT WORKS ───────────────────────────── */}
      <section
        className={`landing-how reveal ${howInView ? 'reveal--visible' : ''}`}
        id="how"
        ref={howRef}
      >
        <h2 className="landing-section__title">
          Three Steps to Your <span className="text-accent">Skyline</span>
        </h2>
        <div className="landing-how__steps">
          <div className="landing-how__step reveal-item" style={{ animationDelay: '0ms' }}>
            <div className="landing-how__number">01</div>
            <h3>Sign in with GitHub</h3>
            <p>One click. We read your public profile, repos, and activity. Nothing private. Ever.</p>
          </div>
          <div className="landing-how__connector" />
          <div className="landing-how__step reveal-item" style={{ animationDelay: '120ms' }}>
            <div className="landing-how__number">02</div>
            <h3>Watch Your City Rise</h3>
            <p>Commits become floors. Repos become towers. Languages paint districts in vivid color.</p>
          </div>
          <div className="landing-how__connector" />
          <div className="landing-how__step reveal-item" style={{ animationDelay: '240ms' }}>
            <div className="landing-how__number">03</div>
            <h3>Explore & Share</h3>
            <p>Fly through your skyline. Compare with friends. Embed your city anywhere. Show off your journey.</p>
          </div>
        </div>
      </section>

      {/* ── SHOWCASE ───────────────────────────────── */}
      <section
        className={`landing-showcase reveal ${showcaseInView ? 'reveal--visible' : ''}`}
        ref={showcaseRef}
      >
        <div className="landing-showcase__inner">
          <div className="landing-showcase__text">
            <h2>Not just a gimmick.<br /><span className="text-accent">A developer identity.</span></h2>
            <p>
              Your traditional GitHub profile is a grid of green squares. GitCity transforms it
              into something you're proud to share — a 3D city that tells your complete developer story.
              The skyscraper you built by shipping every day. The district of React projects.
              The glowing tower from your open-source hit.
            </p>
            <ul className="landing-showcase__list">
              <li>WebGL-powered, 60fps smooth rendering</li>
              <li>10,000+ instanced buildings with custom shaders</li>
              <li>Real-time WebSocket commit streaming</li>
              <li>Day/night cycle, heatmaps, fly-through camera</li>
              <li>Embeddable city widgets for your README</li>
            </ul>
          </div>
          <div className="landing-showcase__visual">
            <div className="landing-showcase__mockup">
              <div className="landing-showcase__screen">
                <HeroScene />
              </div>
              <div className="landing-showcase__hud">
                <div className="landing-showcase__hud-row">
                  <span className="landing-showcase__hud-dot landing-showcase__hud-dot--green" />
                  <span>torvalds</span>
                </div>
                <div className="landing-showcase__hud-row">
                  <span className="landing-showcase__hud-dot landing-showcase__hud-dot--blue" />
                  <span>4,312 commits</span>
                </div>
                <div className="landing-showcase__hud-row">
                  <span className="landing-showcase__hud-dot landing-showcase__hud-dot--purple" />
                  <span>C • 847 repos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────── */}
      <section
        className={`landing-cta reveal ${ctaInView ? 'reveal--visible' : ''}`}
        ref={ctaRef}
      >
        <div className="landing-cta__grid" />
        <div className="landing-cta__glow" />
        <div className="landing-cta__glow landing-cta__glow--2" />
        <div className="landing-cta__inner">
          <div className="landing-hero__badge" style={{ marginBottom: 28 }}>
            <span className="landing-hero__badge-dot" />
            Free &amp; Open Source
          </div>
          <h2 className="landing-cta__title">Ready to see your city?</h2>
          <p className="landing-cta__sub">Join thousands of developers who've already built their skyline.</p>
          <div className="landing-hero__actions">
            <button onClick={onLogin} className="landing-btn landing-btn--primary landing-btn--lg">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 10 }}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Build Your City — Free
            </button>
            <button onClick={onEnter} className="landing-btn landing-btn--ghost">
              Explore Without Signing In →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <span className="landing-nav__logo">◆</span> GitCity
          </div>
          <div className="landing-footer__links">
            <a href="https://github.com/Arunodoy18/GitCity" target="_blank" rel="noopener noreferrer">GitHub</a>
            <span className="landing-footer__sep">·</span>
            <a href="#features">Features</a>
            <span className="landing-footer__sep">·</span>
            <a href="#how">How It Works</a>
            <span className="landing-footer__sep">·</span>
            <a href="#stats">Stats</a>
          </div>
          <div className="landing-footer__copy">
            Built with Three.js, React, and too much ☕
          </div>
        </div>
      </footer>
    </div>
  )
}
