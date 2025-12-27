import React from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { RouteNames } from '../../utils/constants.js';

const stats = [
  { label: 'Atletas inscritos', value: '2.350+' },
  { label: 'Eventos activos', value: '48' },
  { label: 'Instituciones', value: '120' },
];

const featureCards = [
  {
    title: 'Experiencia inmersiva',
    description: 'Animaciones fluidas, transiciones suaves y narrativa deportiva en cada sección.',
  },
  {
    title: 'Datos en tiempo real',
    description: 'Resultados en vivo, clasificaciones automáticas y notificaciones personalizadas.',
  },
  {
    title: 'Cobertura multimedia',
    description: 'Galerías, highlights y reportes estratégicos con insights deportivos.',
  },
];

export const Home = () => (
  <div className="space-y-20">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-500 to-accent p-10 text-white shadow-2xl">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <Badge color="neutral" className="mb-4 bg-white/20 text-white">
          Gestión deportiva integral
        </Badge>
        <h1 className="text-4xl font-display uppercase tracking-wide sm:text-6xl">Impulsa el talento estudiantil</h1>
        <p className="mt-4 max-w-xl text-lg text-white/80">
          Organiza, comunica y analiza eventos deportivos con una plataforma creada para federaciones que exigen excelencia.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <NavLink to={RouteNames.EVENTS}>
<Button variant="outline" className="border-white text-white hover:bg-white/20">
              Explorar eventos
            </Button>          </NavLink>
          <NavLink to={RouteNames.LOGIN}>
            <Button variant="outline" className="border-white text-white hover:bg-white/20">
              Portal administrativo
            </Button>
          </NavLink>
        </div>
      </motion.div>
      <motion.img
        src="https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1200&q=80"
        alt="Equipo celebrando"
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full object-cover shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      />
    </section>
    <section className="grid gap-6 sm:grid-cols-3">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          className="rounded-3xl bg-white/80 p-6 text-center shadow-xl backdrop-blur dark:bg-slate-900/60"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-4xl font-display text-primary-600">{stat.value}</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">{stat.label}</p>
        </motion.div>
      ))}
    </section>
    <section>
      <h2 className="section-title">¿Por qué Agxport?</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {featureCards.map((card) => (
          <motion.article
            key={card.title}
            className="rounded-3xl border border-white/10 bg-white/70 p-6 shadow-xl backdrop-blur-lg transition-transform hover:-translate-y-1 dark:bg-slate-900/50"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{card.title}</h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
          </motion.article>
        ))}
      </div>
    </section>
  </div>
);
