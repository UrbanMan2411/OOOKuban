import React from 'react'
import { motion } from 'framer-motion'
import { Phone, Mail, Globe, MapPin } from 'lucide-react'
import { SlideShell } from '../components/SlideShell'
import { BRAND, CONTACTS } from '../data'

export default function S13_Contacts({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="12 · Контакты и сотрудничество" tone="dark">
      <div className="grid grid-cols-12 gap-10 h-full">
        <div className="col-span-7 flex flex-col justify-center">
          <div className="eyebrow text-sage mb-4">Приглашаем к сотрудничеству</div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="display font-extrabold text-[clamp(36px,4.4vw,70px)] text-paper leading-[0.95]"
          >
            Давайте <span className="text-green-300">дружить.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-6 text-paper/80 text-[clamp(13px,1.05vw,18px)] leading-relaxed max-w-lg"
          >
            Готовы обсудить контракт, СТМ или поставки в ваш регион.
            Подготовим коммерческое предложение под ваш профиль и объём в течение одного рабочего дня.
          </motion.p>
        </div>

        <div className="col-span-5 flex flex-col justify-center gap-3">
          <motion.div
            initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="rounded-2xl glass-dark p-6"
          >
            <div className="eyebrow text-sage mb-3">{BRAND.producer}</div>
            <Row icon={MapPin}>{BRAND.address}</Row>
            <Row icon={Phone}>{CONTACTS.phones.join(' · ')}</Row>
            <Row icon={Mail}>{CONTACTS.emails.join(' · ')}</Row>
            <Row icon={Globe}>{CONTACTS.site}</Row>
          </motion.div>
        </div>
      </div>
    </SlideShell>
  )
}

function Row({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3 text-paper/90 text-[13.5px] py-1.5">
      <Icon size={16} strokeWidth={2} className="text-sage shrink-0" />
      <span>{children}</span>
    </div>
  )
}
