import S01 from './S01_Title'
import S02 from './S02_Market'
import S03 from './S03_About'
import S04 from './S04_Mission'
import S06 from './S06_Audience'
import S07 from './S07_Channels'
import S08 from './S08_Portfolio'
import S09 from './S09_Quality'
import S10 from './S10_PartnerBenefits'
import S11 from './S11_Marketing'
import S12 from './S12_Roadmap'
import S13 from './S13_Contacts'

// Slide registry: each item = { id, title, component }
// The same registry feeds the navigator, progress dots, and the print stack.
export const SLIDES = [
  { id: 'title',       title: 'Титульный лист',                  component: S01 },
  { id: 'market',      title: 'Рынок и тренды',                  component: S02 },
  { id: 'about',       title: 'О компании-производителе',        component: S03 },
  { id: 'mission',     title: 'Миссия и ценности',               component: S04 },
  { id: 'audience',    title: 'Целевая аудитория',               component: S06 },
  { id: 'channels',    title: 'Каналы продаж',                   component: S07 },
  { id: 'portfolio',   title: 'Ассортиментный портфель',         component: S08 },
  { id: 'quality',     title: 'Контроль качества и безопасность', component: S09 },
  { id: 'benefits',    title: 'Преимущества для партнёров',       component: S10 },
  { id: 'marketing',   title: 'Маркетинговая поддержка',          component: S11 },
  { id: 'roadmap',     title: 'Планы развития бренда',            component: S12 },
  { id: 'contacts',    title: 'Контакты и сотрудничество',        component: S13 },
]
