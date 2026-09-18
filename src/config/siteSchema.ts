/**
 * Single source of truth for every piece of editable website content.
 *
 * The public pages read values through `useSiteFields` (which falls back to the
 * defaults below), and the admin Website workspace builds its editing forms
 * from the very same schema — so any field added here is instantly editable in
 * the dashboard and instantly live on the site.
 */

export type FieldType = 'text' | 'textarea' | 'image' | 'url' | 'boolean' | 'list';

export interface ItemField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'image' | 'url';
}

export interface SiteField {
  key: string;            // website_settings.setting_key
  label: string;
  type: FieldType;
  default: any;
  help?: string;
  itemFields?: ItemField[];
}

export interface SiteSection {
  key: string;
  label: string;
  fields: SiteField[];
}

export interface SitePage {
  key: string;
  label: string;
  path: string;
  sections: SiteSection[];
}

const textItem = (extra: ItemField[] = []): ItemField[] => [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  ...extra,
];

export const SITE_PAGES: SitePage[] = [
  /* ------------------------------------------------------------------ */
  {
    key: 'global',
    label: 'Header & Footer',
    path: '/website',
    sections: [
      {
        key: 'announcement',
        label: 'Announcement bar',
        fields: [
          { key: 'global.announcement_enabled', label: 'Show announcement bar', type: 'boolean', default: false },
          { key: 'global.announcement_text', label: 'Announcement text', type: 'text', default: 'Admissions for the new session are open — entrance examinations hold every Saturday at 10am.' },
          { key: 'global.announcement_link', label: 'Announcement link', type: 'url', default: '/website/admissions' },
        ],
      },
      {
        key: 'header',
        label: 'Header',
        fields: [
          { key: 'global.header_cta_label', label: 'Header button label', type: 'text', default: 'Apply now' },
          { key: 'global.header_cta_href', label: 'Header button link', type: 'url', default: '/website/admissions/apply' },
        ],
      },
      {
        key: 'footer',
        label: 'Footer',
        fields: [
          { key: 'global.footer_tagline', label: 'Footer tagline', type: 'textarea', default: 'A school where sound western education and Islamic values grow together.' },
          { key: 'global.footer_note', label: 'Footer small print', type: 'text', default: '© iVintage College. All rights reserved.' },
          { key: 'office_hours', label: 'Office hours', type: 'text', default: 'Mon – Fri, 8AM – 4PM' },
          { key: 'prospectus_url', label: 'Prospectus / brochure link', type: 'url', default: '' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'home',
    label: 'Home page',
    path: '/website',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'hero_badge', label: 'Badge', type: 'text', default: 'Day School | Boarding | Tahfeedh' },
          { key: 'hero_title', label: 'Headline', type: 'text', default: '…redefining western and' },
          { key: 'hero_title_highlight', label: 'Headline highlight', type: 'text', default: 'Islamic intellectualism' },
          { key: 'hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'A Lagos secondary school where strong academics, ICT and coding, Qur’an memorisation and leadership training grow together.' },
          { key: 'hero_cta_primary_label', label: 'Primary button', type: 'text', default: 'Apply for admission' },
          { key: 'hero_cta_secondary_label', label: 'Secondary button', type: 'text', default: 'Take a campus tour' },
          {
            key: 'hero_images', label: 'Hero images', type: 'list',
            default: ['/campus.png', '/img1.png', '/img2.png', '/img3.png'],
            itemFields: [{ key: '', label: 'Image', type: 'image' }],
            help: 'Images rotate in the hero slideshow.',
          },
        ],
      },
      {
        key: 'pillars',
        label: 'Why choose us',
        fields: [
          { key: 'home_pillars_heading', label: 'Heading', type: 'text', default: 'A perfect blend of western and Islamic education' },
          { key: 'home_pillars_intro', label: 'Intro', type: 'textarea', default: 'Four pillars shape every child who passes through iVintage College — with coding a major component.' },
          {
            key: 'home_pillars', label: 'Pillars', type: 'list',
            itemFields: textItem([{ key: 'image', label: 'Image', type: 'image' }]),
            default: [
              { title: 'Academic excellence', description: 'Sound, highly qualitative western education, with distinction scores maintained in both internal and external examinations.', image: '/img1.png' },
              { title: 'ICT and coding', description: 'Proficiency in Microsoft Office (Word, Excel, PowerPoint, Access), basic programming and coding, and robotics.', image: '/img3.png' },
              { title: 'Hifdhul Qur’an, Islamic education and Arabic', description: 'Qur’an memorisation — at least a quarter of the whole Qur’an — Arabic literacy and proficiency, very sound morals, and a high level of understanding of Islamic beliefs and values.', image: '/img2.png' },
              { title: 'Leadership development', description: 'Leadership training classes, mentoring and coaching programmes, clubs and associations (literacy and debating, book readers, karate and more), plus guidance and counselling.', image: '/campus.png' },
            ],
          },
        ],
      },
      {
        key: 'programmes',
        label: 'Programmes',
        fields: [
          { key: 'home_programmes_heading', label: 'Heading', type: 'text', default: 'Our Academic Programmes' },
          { key: 'home_programmes_intro', label: 'Intro', type: 'textarea', default: 'One school, one standard — from the first day to the final senior secondary examination.' },
          {
            key: 'home_programmes', label: 'Programmes', type: 'list',
            itemFields: textItem([
              { key: 'ages', label: 'Classes', type: 'text' },
              { key: 'image', label: 'Image', type: 'image' },
              { key: 'href', label: 'Link', type: 'url' },
            ]),
            default: [
              { title: 'Junior Secondary', ages: 'JSS 1 – 3', description: 'Core academics, sciences and vocational exposure preparing every student for the BECE and senior school.', image: '/img3.png' },
              { title: 'Senior Secondary', ages: 'SSS 1 – 3', description: 'Science, Commercial and Arts tracks with focused WAEC, NECO and university-entrance preparation.', image: '/campus.png' },
            ],
          },
        ],
      },
      {
        key: 'principal',
        label: 'Principal’s welcome',
        fields: [
          { key: 'principal_name', label: 'Name', type: 'text', default: 'The Principal' },
          { key: 'principal_title', label: 'Title', type: 'text', default: 'iVintage College' },
          { key: 'principal_photo_url', label: 'Photo', type: 'image', default: '' },
          { key: 'principal_message', label: 'Message', type: 'textarea', default: 'At iVintage College, bright minds are nurtured into principled leaders — in the classroom, in the boarding house and in the Tahfeedh school.' },
        ],
      },
      {
        key: 'admissions',
        label: 'Admissions at a glance',
        fields: [
          { key: 'home_key_dates_heading', label: 'Heading', type: 'text', default: 'Admissions at a glance' },
          { key: 'home_key_dates_note', label: 'Note', type: 'textarea', default: 'Entrance examinations hold every Saturday at 10am prompt. Apply early — places in each class are limited.' },
          {
            key: 'home_key_dates', label: 'Key dates', type: 'list',
            itemFields: [
              { key: 'label', label: 'Label', type: 'text' },
              { key: 'value', label: 'Value', type: 'text' },
            ],
            default: [
              { label: 'Applications', value: 'Now open' },
              { label: 'Entrance examination', value: 'Every Saturday, 10am prompt' },
              { label: 'Enquiry lines', value: '+234 818 803 2057, +234 805 317 1279' },
              { label: 'New session begins', value: 'September' },
            ],
          },
        ],
      },
      {
        key: 'achievements',
        label: 'Achievements',
        fields: [
          { key: 'home_achievements_heading', label: 'Heading', type: 'text', default: 'Results that speak for themselves' },
          { key: 'home_achievements_intro', label: 'Intro', type: 'textarea', default: 'Consistent performance, year after year.' },
          {
            key: 'home_achievements', label: 'Achievements', type: 'list',
            itemFields: [
              { key: 'value', label: 'Figure', type: 'text' },
              { key: 'label', label: 'Label', type: 'text' },
            ],
            default: [],
          },
        ],
      },
      {
        key: 'apply',
        label: 'How to apply',
        fields: [
          {
            key: 'how_to_apply_steps', label: 'Steps', type: 'list',
            itemFields: textItem(),
            default: [],
          },
        ],
      },
      {
        key: 'visit',
        label: 'Visit us',
        fields: [
          { key: 'home_visit_heading', label: 'Heading', type: 'text', default: 'Come and see the school' },
          { key: 'home_visit_intro', label: 'Intro', type: 'textarea', default: 'Book a visit and meet the team that will teach your child.' },
        ],
      },
      {
        key: 'newsletter',
        label: 'Newsletter',
        fields: [
          { key: 'newsletter_enabled', label: 'Show newsletter sign-up', type: 'boolean', default: true },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'about',
    label: 'About page',
    path: '/website/about',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'about_hero_title', label: 'Headline', type: 'text', default: 'About' },
          { key: 'about_hero_highlight', label: 'Headline highlight', type: 'text', default: 'iVintage College' },
          { key: 'about_hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'A school built on sound scholarship, strong character and service.' },
          { key: 'about_hero_image', label: 'Hero image', type: 'image', default: '' },
          { key: 'about_years_badge', label: 'Years badge', type: 'text', default: '' },
          { key: 'about_founding_year', label: 'Founding year', type: 'text', default: '' },
        ],
      },
      {
        key: 'purpose',
        label: 'Vision, mission & values',
        fields: [
          { key: 'about_vision', label: 'Vision', type: 'textarea', default: '' },
          { key: 'about_mission', label: 'Mission', type: 'textarea', default: '' },
          { key: 'about_target', label: 'Our target', type: 'textarea', default: '' },
          {
            key: 'about_values', label: 'Core values', type: 'list',
            itemFields: textItem(),
            default: [],
          },
        ],
      },
      {
        key: 'history',
        label: 'Our story',
        fields: [
          { key: 'about_history_image', label: 'Image', type: 'image', default: '' },
          {
            key: 'about_history_paragraphs', label: 'Paragraphs', type: 'list',
            itemFields: [{ key: '', label: 'Paragraph', type: 'textarea' }],
            default: [],
          },
        ],
      },
      {
        key: 'leadership',
        label: 'Leadership',
        fields: [
          {
            key: 'about_leaders', label: 'Leaders', type: 'list',
            itemFields: [
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'role', label: 'Role', type: 'text' },
              { key: 'bio', label: 'Bio', type: 'textarea' },
              { key: 'image', label: 'Photo', type: 'image' },
            ],
            default: [],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'admissions',
    label: 'Admissions page',
    path: '/website/admissions',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'admissions.hero_eyebrow', label: 'Eyebrow', type: 'text', default: 'Join iVintage College' },
          { key: 'admissions.hero_title', label: 'Headline', type: 'text', default: 'Begin Your Journey to' },
          { key: 'admissions.hero_highlight', label: 'Headline highlight', type: 'text', default: 'Academic Excellence' },
          { key: 'admissions.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'We welcome bright, motivated students ready to embrace our culture of excellence, integrity and character development. Start your application today.' },
        ],
      },
      {
        key: 'highlights',
        label: 'Why families choose us',
        fields: [
          { key: 'admissions.highlights_title', label: 'Heading', type: 'text', default: 'Why families choose us' },
          { key: 'admissions.highlights_intro', label: 'Intro', type: 'textarea', default: 'The advantages that make us a preferred choice for quality education.' },
          {
            key: 'admissions.highlights', label: 'Highlights', type: 'list',
            itemFields: textItem(),
            default: [
              { title: 'Strong exam results', description: 'Consistent performance in WAEC, NECO and JAMB examinations.' },
              { title: 'Small class sizes', description: 'Around 25 students per class, so every child is known and supported.' },
              { title: 'Modern curriculum', description: 'Technology, critical thinking and 21st-century skills woven throughout.' },
              { title: 'Qualified teachers', description: 'Experienced, certified educators committed to academics and character.' },
              { title: 'Holistic development', description: 'A balance of academics, faith, sport and extracurricular life.' },
              { title: 'Affordable fees', description: 'Competitive rates with flexible payment options available.' },
            ],
          },
        ],
      },
      {
        key: 'process',
        label: 'Admission process',
        fields: [
          { key: 'admissions.process_title', label: 'Heading', type: 'text', default: 'Four steps to admission' },
          { key: 'admissions.process_intro', label: 'Intro', type: 'textarea', default: 'A simple, transparent process designed for your convenience.' },
          {
            key: 'admissions.process_steps', label: 'Steps', type: 'list',
            itemFields: textItem(),
            default: [
              { title: 'Submit application', description: 'Complete and submit the online admission form with the required documents.' },
              { title: 'Entrance examination', description: 'Attend the scheduled entrance examination and interview.' },
              { title: 'Payment of fees', description: 'Pay admission and first term fees upon acceptance.' },
              { title: 'Resume classes', description: 'Join your assigned class and begin your iVintage journey.' },
            ],
          },
        ],
      },
      {
        key: 'requirements',
        label: 'Requirements checklist',
        fields: [
          { key: 'admissions.requirements_title', label: 'Heading', type: 'text', default: 'What you need to apply' },
          { key: 'admissions.requirements_intro', label: 'Intro', type: 'textarea', default: 'Have these documents ready before you start the online form.' },
          {
            key: 'admissions.requirements', label: 'Documents', type: 'list',
            itemFields: [{ key: '', label: 'Document', type: 'text' }],
            default: [
              'Birth Certificate or Age Declaration',
              'Previous School Report Card / Transcript',
              'Passport Photographs (4 copies)',
              'Medical Certificate of Fitness',
              'Primary Six Leaving Certificate (for JSS1)',
              'JSS3 Certificate (for SSS1)',
              'Letter of Good Conduct from Previous School',
            ],
          },
        ],
      },
      {
        key: 'cta',
        label: 'Ready to apply',
        fields: [
          { key: 'admissions.cta_title', label: 'Heading', type: 'text', default: 'Ready to apply?' },
          { key: 'admissions.cta_text', label: 'Text', type: 'textarea', default: 'Take the first step towards joining our community of excellence. Our admissions team is ready to guide you through the process.' },
          {
            key: 'admissions.contacts', label: 'Contact cards', type: 'list',
            itemFields: [
              { key: 'label', label: 'Label', type: 'text' },
              { key: 'value', label: 'Value', type: 'text' },
            ],
            default: [
              { label: 'Admissions office', value: '+234 813 418 7710' },
              { label: 'Email', value: 'admissions@ivintagecollege.com' },
              { label: 'Office hours', value: 'Mon – Fri, 8AM – 4PM' },
            ],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'school-life',
    label: 'School life page',
    path: '/website/school-life',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'school_life.hero_eyebrow', label: 'Eyebrow', type: 'text', default: 'School Life at iVintage' },
          { key: 'school_life.hero_title', label: 'Headline', type: 'text', default: 'Academic Excellence &' },
          { key: 'school_life.hero_highlight', label: 'Headline highlight', type: 'text', default: 'Holistic Development' },
          { key: 'school_life.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'A vibrant school life that combines rigorous academics with character development, extracurricular activities and a supportive community.' },
        ],
      },
      {
        key: 'programmes',
        label: 'Academic tracks',
        fields: [
          { key: 'school_life.programmes_title', label: 'Heading', type: 'text', default: 'Academic programmes' },
          { key: 'school_life.programmes_intro', label: 'Intro', type: 'textarea', default: 'Comprehensive tracks designed to prepare students for higher education and career success.' },
          {
            key: 'school_life.programmes', label: 'Tracks', type: 'list',
            itemFields: textItem([{ key: 'subjects', label: 'Core subjects (comma separated)', type: 'text' }]),
            default: [
              { title: 'Science Track', description: 'Comprehensive science education preparing students for medical and engineering careers.', subjects: 'Biology, Chemistry, Physics, Mathematics, English' },
              { title: 'Commercial Track', description: 'Business-focused curriculum developing entrepreneurial and financial skills.', subjects: 'Accounting, Economics, Commerce, Mathematics, English' },
              { title: 'Arts Track', description: 'Liberal arts programme fostering critical thinking, language and cultural awareness.', subjects: 'Literature, Government, History, Islamic Studies, Arabic' },
              { title: 'Tahfeedh & Arabic', description: 'Qur’an memorisation and Arabic proficiency running alongside the academic curriculum.', subjects: 'Hifdhul Qur’an, Tajweed, Arabic Language, Islamic Studies' },
            ],
          },
        ],
      },
      {
        key: 'structure',
        label: 'Class structure',
        fields: [
          {
            key: 'school_life.structure', label: 'Structure cards', type: 'list',
            itemFields: textItem([{ key: 'level', label: 'Level', type: 'text' }]),
            default: [
              { level: 'JSS 1 – 3', title: 'Junior Secondary', description: 'Broad curriculum leading to BECE, with early subject guidance.' },
              { level: 'SSS 1 – 3', title: 'Senior Secondary', description: 'Specialised tracks preparing students for WAEC, NECO and JAMB.' },
              { level: '20–25', title: 'Class size', description: 'Small classes so every child is known, tracked and supported.' },
            ],
          },
        ],
      },
      {
        key: 'schedule',
        label: 'A day at iVintage',
        fields: [
          {
            key: 'school_life.schedule', label: 'Daily schedule', type: 'list',
            itemFields: [
              { key: 'time', label: 'Time', type: 'text' },
              { key: 'activity', label: 'Activity', type: 'text' },
            ],
            default: [
              { time: '7:30 – 8:00 AM', activity: 'Morning assembly & prayers' },
              { time: '8:00 – 11:30 AM', activity: 'First academic session' },
              { time: '11:30 – 12:00 PM', activity: 'Break & refreshments' },
              { time: '12:00 – 1:00 PM', activity: 'Second academic session' },
              { time: '1:00 – 2:00 PM', activity: 'Lunch break & prayers' },
              { time: '2:00 – 4:00 PM', activity: 'Madrasah & study period' },
            ],
          },
        ],
      },
      {
        key: 'clubs',
        label: 'Clubs & activities',
        fields: [
          {
            key: 'school_life.clubs', label: 'Clubs', type: 'list',
            itemFields: [{ key: '', label: 'Club', type: 'text' }],
            default: [
              'Debate Club', 'Science Club', 'Literature Society', 'Mathematics Club',
              'Football Team', 'Basketball Team', 'Athletics', 'Table Tennis',
              'Quranic Recitation', 'Arabic Calligraphy', 'ICT & Coding Club', 'Leadership Development',
            ],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'facilities',
    label: 'Facilities page',
    path: '/website/facilities',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'facilities.hero_title', label: 'Headline', type: 'text', default: 'World-Class Facilities' },
          { key: 'facilities_intro', label: 'Sub-headline', type: 'textarea', default: 'Modern infrastructure designed to support effective teaching, learning and character development.' },
        ],
      },
      {
        key: 'list',
        label: 'Facilities',
        fields: [
          { key: 'facilities.section_title', label: 'Heading', type: 'text', default: 'Built for how children actually learn' },
          { key: 'facilities.section_intro', label: 'Intro', type: 'textarea', default: 'Every space on campus is there for a reason — study, science, sport, safety and rest.' },
          {
            key: 'facilities', label: 'Facilities', type: 'list',
            itemFields: textItem([{ key: 'image', label: 'Image', type: 'image' }]),
            default: [
              { title: 'iLead Vintage College (Day School)', description: 'Purpose-built classrooms on the Akinsanya Estate campus, with small class sizes and dedicated subject teachers.' },
              { title: 'iLead Vintage Boarding House', description: 'Supervised boarding with structured prep, morning and evening prayers, and full-time house parents.' },
              { title: 'iLead Tahfeedh School', description: 'Dedicated Qur’an memorisation and Arabic programme running alongside the academic curriculum.' },
              { title: 'ICT and Coding Laboratory', description: 'Networked computer lab where every student learns digital literacy, coding and problem solving.' },
              { title: 'Science Laboratories', description: 'Equipped Biology, Chemistry and Physics laboratories for practical work and WAEC/NECO preparation.' },
              { title: 'Library and Resource Centre', description: 'Reference books, past questions and quiet study space for private and supervised reading.' },
              { title: 'Sports and Recreation', description: 'Football, basketball, athletics and table tennis, with inter-house competitions each session.' },
              { title: 'Kitchen and Dining', description: 'Hygienic kitchen serving balanced meals for boarders and day students.' },
            ],
          },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'gallery',
    label: 'Gallery page',
    path: '/website/gallery',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'gallery.hero_title', label: 'Headline', type: 'text', default: 'Life at iVintage' },
          { key: 'gallery.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'Moments from the classroom, the Tahfeedh school, the sports field and school events.' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'news',
    label: 'News page',
    path: '/website/news',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'news.hero_title', label: 'Headline', type: 'text', default: 'News & Events' },
          { key: 'news.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'Announcements, achievements and upcoming events from around the school.' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'testimonials',
    label: 'Testimonials page',
    path: '/website/testimonials',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'testimonials.hero_title', label: 'Headline', type: 'text', default: 'What parents and students say' },
          { key: 'testimonials.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'Honest words from the families who trust us with their children.' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'careers',
    label: 'Careers page',
    path: '/website/careers',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'careers.hero_title', label: 'Headline', type: 'text', default: 'Work with us' },
          { key: 'careers.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'Join a team of educators raising scholars of character. Open roles are listed below.' },
          { key: 'careers.empty_text', label: 'Text when no roles are open', type: 'textarea', default: 'There are no open roles at the moment. Please check back soon.' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'portals',
    label: 'Portals page',
    path: '/website/portals',
    sections: [
      {
        key: 'hero',
        label: 'Hero',
        fields: [
          { key: 'portals.hero_title', label: 'Headline', type: 'text', default: 'Portals' },
          { key: 'portals.hero_subtitle', label: 'Sub-headline', type: 'textarea', default: 'Sign in to the portal for students, parents, teachers and administrators.' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'apply',
    label: 'Application page',
    path: '/website/admissions/apply',
    sections: [
      {
        key: 'intro',
        label: 'Form introduction',
        fields: [
          { key: 'apply.title', label: 'Headline', type: 'text', default: 'Application for admission' },
          { key: 'apply.intro', label: 'Intro', type: 'textarea', default: 'Complete every section. You will receive an application number to track progress.' },
          { key: 'apply.help_text', label: 'Help note', type: 'textarea', default: 'Need help? Call the admissions office on +234 813 418 7710.' },
          { key: 'apply.success_text', label: 'Text after submitting', type: 'textarea', default: 'Your application has been received. Keep your application number safe — you will need it to track your application.' },
        ],
      },
    ],
  },
];

/* --------------------------------------------------------------------- */

export const SITE_DEFAULTS: Record<string, any> = (() => {
  const map: Record<string, any> = {};
  SITE_PAGES.forEach((page) =>
    page.sections.forEach((section) =>
      section.fields.forEach((field) => {
        map[field.key] = field.default;
      }),
    ),
  );
  return map;
})();

export function getPage(pageKey: string): SitePage | undefined {
  return SITE_PAGES.find((p) => p.key === pageKey);
}
