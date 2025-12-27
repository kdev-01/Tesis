import React from 'react';
import { motion } from 'framer-motion';

const values = [
  {
    title: 'Desarrollo de talento',
    description: 'Creamos ecosistemas donde los estudiantes deportistas pueden crecer con acompañamiento integral.',
  },
  {
    title: 'Innovación constante',
    description: 'Incorporamos analítica y automatización para decisiones estratégicas en tiempo real.',
  },
  {
    title: 'Experiencia inclusiva',
    description: 'Diseño accesible, responsivo y coherente con las necesidades de cada institución.',
  },
];

export const About = () => (
  <div className="space-y-14">
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h1 className="section-title">Nosotros</h1>
      <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
        Somos la Federación Deportiva Provincial Estudiantil de Napo. Nuestra misión es acompañar a las instituciones educativas
        en la organización de eventos deportivos de alto impacto, garantizando experiencias memorables para atletas, familias y
        comunidades.
      </p>
    </motion.section>
    <section className="grid gap-6 md:grid-cols-3">
      {values.map((value, index) => (
        <motion.article
          key={value.title}
          className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/60"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
        >
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{value.title}</h3>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{value.description}</p>
        </motion.article>
      ))}
    </section>
    <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <h2 className="section-title">Nuestra historia</h2>
      <div className="space-y-6">
        {[
          { year: '2018', text: 'Digitalizamos las acreditaciones y los reportes estadísticos de campeonatos.' },
          { year: '2020', text: 'Implementamos seguimiento remoto para entrenamientos en casa.' },
          { year: '2024', text: 'Integración con plataformas de streaming y narración en vivo.' },
        ].map((item) => (
          <div
            key={item.year}
            className="rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900/60"
          >
            <p className="text-sm font-semibold text-primary-600">{item.year}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
          </div>
        ))}
      </div>
    </motion.section>
  </div>
);
