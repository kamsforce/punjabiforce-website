/* ==========================================================================
   Punjabiforce — site content
   Edit this file to update the site. No HTML changes needed.
   ========================================================================== */

const PF_DATA = {

  /* ---- Founders ------------------------------------------------------
     Set `linkedin` to a profile URL, or leave as '' to hide the icon.
     -------------------------------------------------------------------- */
  founders: [
    {
      name: 'Kam S. Matharu',
      role: 'Lead Salesforce Consultant · Punjabiforce Founder',
      photo: 'media/kam.jpg',
      linkedin: 'https://www.linkedin.com/in/ksmatharu1/',
      bio: '22+ years in IT and 13 Salesforce certifications, building the guild\u2019s mentoring, coaching and community programmes.'
    },
    {
      name: 'Harpreet Dulai',
      role: 'Associate Director · Punjabiforce Founder',
      photo: 'media/harpreet.jpg',
      linkedin: 'https://www.linkedin.com/in/harpreet-dulai/',
      bio: 'Co-founder driving Punjabiforce\u2019s mission to uplift professionals globally while celebrating culture and embracing diversity.'
    }
  ],

  /* ---- Advisor & Community Ambassadors -------------------------------
     Set `linkedin` to a profile URL, or leave as '' to hide the icon.
     -------------------------------------------------------------------- */
  team: [
    {
      name: 'Vijay Sood',
      title: 'Advisor',
      meta: 'EMEA Lead, VP CMT (Global) \u2014 Enterprise Solutions',
      photo: 'media/vijay.jpg',
      linkedin: 'https://www.linkedin.com/in/vijay-sood/'
    },
    {
      name: 'Gautam Sharma',
      title: 'Advisor',
      meta: 'Growth for Generative AI and Autonomous Agents, Salesforce UKI',
      photo: 'media/gautam.png',
      linkedin: 'https://www.linkedin.com/in/gautam434/'
    },
    {
      name: 'Jind Kaur',
      title: 'Community Ambassador',
      meta: 'Commercial Salesforce Lead',
      photo: 'media/jind.jpg',
      linkedin: 'https://www.linkedin.com/in/jindkaur/'
    },
    {
      name: 'Mino Matharu',
      title: 'Community Ambassador',
      meta: 'CRM Executive, Salesforce',
      photo: 'media/mino.jpg',
      linkedin: 'https://www.linkedin.com/in/minom20/'
    },
    {
      name: 'Aalok Gupta',
      title: 'Community Ambassador',
      meta: 'Technical focus',
      photo: 'media/aalok.jpg',
      linkedin: 'https://www.linkedin.com/in/aalokkumargupta/'
    }
  ],

  /* ---- Values / pillars --------------------------------------------- */
  pillars: [
    { title: 'Knowledge Sharing', text: 'Building a culture where learning is open, continuous, and accessible to all.' },
    { title: 'Community Growth', text: 'Growing stronger together by supporting each other\u2019s personal and professional journeys.' },
    { title: 'Career Support', text: 'Providing mentorship, guidance, and opportunities to help professionals advance with confidence.' },
    { title: 'Cultural Pride', text: 'Celebrating Punjabi identity, language, and heritage across the globe.' },
    { title: 'Global Connection', text: 'Linking professionals worldwide to collaborate and inspire each other.' },
    { title: 'Value Driven', text: 'Guided by principles of resilience, unity, and service in everything we do.' },
    { title: 'Inclusive Network', text: 'Welcoming all professionals who believe in growth, collaboration, and community.' }
  ],

  /* ---- Events -------------------------------------------------------- */
  events: [
    {
      when: 'Jun 2026',
      title: 'Salesforce Agentforce World Tour',
      text: 'Punjabiforce out in force at the Agentforce World Tour \u2014 connecting with the wider Trailblazer community.',
      tag: 'In person'
    },
    {
      when: 'Apr 2026',
      title: 'Mastering Agentforce',
      text: 'A deep dive into Agentforce builder, actions and agent scripts with Karan Verma and the Punjabiforce team.',
      tag: 'Webinar'
    },
    {
      when: 'Mar 2026',
      title: 'International Women\u2019s Day \u2014 Give to Gain',
      text: 'A panel with Jasmine Pank, Pei Mun Lim and Ruby McCormack on visibility, sponsorship and giving back.',
      tag: 'Panel'
    },
    {
      when: 'Feb 2026',
      title: 'Women Who Lead & Develop Communities',
      text: 'A Community Brews session on building and sustaining communities, hosted with Ankita Dhamgaya.',
      tag: 'Virtual'
    },
    {
      when: 'Jan\u2013Jun 2026',
      title: 'In-person meetups \u2014 London',
      text: 'Regular meetups hosted with our partners, bringing Salesforce and tech professionals together face to face.',
      tag: 'In person'
    }
  ],

  /* ---- Volunteer focus areas ---------------------------------------- */
  /* Every volunteer holds the title "Punjabiforce Community Ambassador".
     These are focus areas an Ambassador can lean into \u2014 not separate titles. */
  roles: [
    {
      focus: 'Operational focus',
      title: 'Community Ambassador \u2014 Operations',
      text: 'Helps keep the core teams moving in step and supports member engagement across the community.',
      points: [
        'Supports the Events, Technical and Marketing teams',
        'Drives member engagement and leadership development',
        'Keeps community initiatives and programmes on track'
      ]
    },
    {
      focus: 'Events focus',
      title: 'Community Ambassador \u2014 Events',
      text: 'Shapes event strategy, execution and partnerships across the community calendar.',
      points: [
        'Organises meetups, webinars and conferences',
        'Builds venue and sponsor partnerships',
        'Works with regional teams to keep event quality consistent'
      ]
    },
    {
      focus: 'Marketing & comms focus',
      title: 'Community Ambassador \u2014 Marketing & Comms',
      text: 'Looks after community branding and outreach so our work reaches the people who need it.',
      points: [
        'Handles social media, content and public relations',
        'Promotes achievements and events globally',
        'Keeps brand and tone consistent across channels'
      ]
    },
    {
      focus: 'Technical focus',
      title: 'Community Ambassador \u2014 Technical',
      text: 'Supports the community\u2019s technical programmes and keeps things running behind the scenes.',
      points: [
        'Shapes session content and hands-on technical material',
        'Supports members with Salesforce know-how',
        'Looks after community tooling and platforms'
      ]
    }
  ],

  /* ---- Stats --------------------------------------------------------- */
  stats: [
    { num: '6+', label: 'In-person & virtual events' },
    { num: '2', label: 'Founding partners \u2014 EPAM & Grant Thornton' },
    { num: '1', label: 'Guild \u2014 open to any faith or background' },
    { num: '2026', label: 'Agentforce World Tour appearance' }
  ],

  /* ---- Sponsors ------------------------------------------------------ */
  sponsors: ['epam', 'Grant Thornton'],

  /* ---- Gallery ---------------------------------------------------------
     Put photos in media/gallery/ and add one line per photo here.
     Example:  { src: 'media/gallery/fca-panel.jpg', caption: 'FCA panel, Oct 2026' },
     -------------------------------------------------------------------- */
  gallery: [
  ],

  /* ---- Social links -------------------------------------------------- */
  socials: {
    handle: '@punjabiforcenet',
    linkedin: 'https://www.linkedin.com/company/punjabiforcenet',
    instagram: 'https://www.instagram.com/punjabiforcenet',
    x: 'https://x.com/punjabiforcenet',
    facebook: 'https://www.facebook.com/punjabiforcenet'
  }
};