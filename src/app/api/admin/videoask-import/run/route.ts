import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getImpacterClient } from '@/lib/impacter-client';

function extractUuid(url: string): string | null {
  const m = url.match(/\/transcoded\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

// Map VideoAsk internal media_type values to readable response types
function normalizeResponseType(raw: string, url?: string): string {
  // No URL = typed/text response regardless of what VideoAsk says
  if (url !== undefined && url === '') return 'text';
  switch (raw.toLowerCase()) {
    case 'standard': {
      // Derive from URL extension: .mp3 = audio, .mp4 = video
      const lower = (url ?? '').toLowerCase();
      if (lower.includes('.mp3')) return 'audio';
      if (lower.includes('.mp4')) return 'video';
      return 'video'; // fallback
    }
    case 'audio':    return 'audio';
    case 'text':     return 'text';
    case 'poll':     return 'poll';
    case 'file':     return 'file';
    default:         return raw;
  }
}

// The valid student_responses columns we can populate
const SR_COLUMNS = new Set([
  'district_name', 'school_name', 'class_name', 'teacher_name',
  'current_grade', 'gender', 'hispanic', 'ell', 'frl', 'iep',
  'ethnicity', 'home_language', 'session_name', 'course_id',
  'response_type', 'question', 'answer', 'harvard_attribute',
  'harvard_score', 'casel_attribute', 'casel_score', 'url',
  'answer_date', 'source_id',
  'first_name', 'last_name', 'student_email',
]);

// ── Alliterative positive student name generation ─────────────────────────

// Each first name tagged: 'f' = female-coded, 'm' = male-coded, 'n' = neutral
type NameEntry = { name: string; g: 'f' | 'm' | 'n' };

const ALLITERATIVE_NAMES: Record<string, { first: NameEntry[]; trait: string[] }> = {
  A: { first: [
    {name:'Aaliyah',g:'f'},{name:'Abby',g:'f'},{name:'Ada',g:'f'},{name:'Aliya',g:'f'},{name:'Amy',g:'f'},{name:'Amara',g:'f'},{name:'Aurora',g:'f'},
    {name:'Adriana',g:'f'},{name:'Aisha',g:'f'},{name:'Alana',g:'f'},{name:'Alyssa',g:'f'},{name:'Amber',g:'f'},{name:'Anaya',g:'f'},{name:'Ariana',g:'f'},{name:'Autumn',g:'f'},{name:'Alejandra',g:'f'},{name:'Alma',g:'f'},
    {name:'Aaron',g:'m'},{name:'Ace',g:'m'},{name:'Aiden',g:'m'},{name:'Alvin',g:'m'},{name:'Andre',g:'m'},
    {name:'Abel',g:'m'},{name:'Abraham',g:'m'},{name:'Adrian',g:'m'},{name:'Ahmad',g:'m'},{name:'Alejandro',g:'m'},{name:'Alonso',g:'m'},{name:'Armando',g:'m'},{name:'Arturo',g:'m'},{name:'Axel',g:'m'},
    {name:'Alex',g:'n'},{name:'Avery',g:'n'},{name:'Ash',g:'n'},{name:'Ari',g:'n'},{name:'Aspen',g:'n'},{name:'Aubrey',g:'n'},
  ], trait: ['Achiever','Adventurous','Amazing','Ambitious','Artistic','Attentive','Authentic','Awesome','Adaptive','Assured','Agile','Alert','Alive','Aspiring','Astute'] },
  B: { first: [
    {name:'Bianca',g:'f'},{name:'Brianna',g:'f'},{name:'Brooke',g:'f'},{name:'Bella',g:'f'},{name:'Beatrice',g:'f'},
    {name:'Bethany',g:'f'},{name:'Bonnie',g:'f'},{name:'Bria',g:'f'},{name:'Bridget',g:'f'},{name:'Blossom',g:'f'},{name:'Brenda',g:'f'},{name:'Bernadette',g:'f'},
    {name:'Ben',g:'m'},{name:'Bobby',g:'m'},{name:'Brandon',g:'m'},{name:'Bruno',g:'m'},{name:'Bryson',g:'m'},{name:'Barrett',g:'m'},
    {name:'Bradley',g:'m'},{name:'Brendan',g:'m'},{name:'Brett',g:'m'},{name:'Brody',g:'m'},{name:'Byron',g:'m'},{name:'Bernard',g:'m'},{name:'Beau',g:'m'},
    {name:'Bailey',g:'n'},{name:'Blake',g:'n'},{name:'Blair',g:'n'},{name:'Bay',g:'n'},{name:'Billie',g:'n'},{name:'Brighton',g:'n'},
  ], trait: ['Balanced','Brave','Bright','Brilliant','Bubbly','Bold','Bouncy','Benevolent','Blossoming','Beaming','Boundless','Blooming','Becoming','Breathtaking','Building'] },
  C: { first: [
    {name:'Camila',g:'f'},{name:'Carmen',g:'f'},{name:'Chloe',g:'f'},{name:'Clara',g:'f'},{name:'Cora',g:'f'},{name:'Celeste',g:'f'},
    {name:'Cassidy',g:'f'},{name:'Catalina',g:'f'},{name:'Cecilia',g:'f'},{name:'Chelsea',g:'f'},{name:'Christina',g:'f'},{name:'Ciara',g:'f'},{name:'Claudia',g:'f'},{name:'Constance',g:'f'},{name:'Crystal',g:'f'},
    {name:'Caleb',g:'m'},{name:'Carlos',g:'m'},{name:'Cole',g:'m'},{name:'Connor',g:'m'},{name:'Cruz',g:'m'},
    {name:'Carl',g:'m'},{name:'Cedric',g:'m'},{name:'Christian',g:'m'},{name:'Cody',g:'m'},{name:'Colin',g:'m'},{name:'Cyrus',g:'m'},{name:'Corbin',g:'m'},{name:'Christopher',g:'m'},
    {name:'Casey',g:'n'},{name:'Charlie',g:'n'},{name:'Corey',g:'n'},{name:'Cedar',g:'n'},{name:'Cypress',g:'n'},
  ], trait: ['Calm','Capable','Caring','Cheerful','Clever','Compassionate','Confident','Creative','Curious','Courageous','Centered','Charming','Committed','Connected','Consistent'] },
  D: { first: [
    {name:'Danika',g:'f'},{name:'Deja',g:'f'},{name:'Diana',g:'f'},{name:'Dahlia',g:'f'},{name:'Destiny',g:'f'},
    {name:'Daniela',g:'f'},{name:'Daphne',g:'f'},{name:'Daisy',g:'f'},{name:'Delilah',g:'f'},{name:'Delaney',g:'f'},{name:'Demi',g:'f'},{name:'Dominique',g:'f'},{name:'Dora',g:'f'},
    {name:'Damian',g:'m'},{name:'Danny',g:'m'},{name:'Derek',g:'m'},{name:'Diego',g:'m'},{name:'Dominic',g:'m'},{name:'Damon',g:'m'},
    {name:'Dale',g:'m'},{name:'Dante',g:'m'},{name:'Darius',g:'m'},{name:'David',g:'m'},{name:'Dean',g:'m'},{name:'Devin',g:'m'},{name:'Donovan',g:'m'},{name:'Duncan',g:'m'},
    {name:'Dakota',g:'n'},{name:'Dylan',g:'n'},{name:'Drew',g:'n'},{name:'Darcy',g:'n'},{name:'Devyn',g:'n'},
  ], trait: ['Daring','Dedicated','Delightful','Determined','Devoted','Diligent','Dynamic','Driven','Dazzling','Dependable','Decisive','Deep','Deserving','Dignified','Disciplined'] },
  E: { first: [
    {name:'Elena',g:'f'},{name:'Elisa',g:'f'},{name:'Ella',g:'f'},{name:'Emma',g:'f'},{name:'Eva',g:'f'},{name:'Esme',g:'f'},
    {name:'Ebony',g:'f'},{name:'Eliana',g:'f'},{name:'Ellie',g:'f'},{name:'Emily',g:'f'},{name:'Esperanza',g:'f'},{name:'Estrella',g:'f'},{name:'Evelyn',g:'f'},{name:'Evie',g:'f'},{name:'Elaine',g:'f'},
    {name:'Eddie',g:'m'},{name:'Eli',g:'m'},{name:'Elijah',g:'m'},{name:'Eric',g:'m'},{name:'Ethan',g:'m'},{name:'Emilio',g:'m'},
    {name:'Edgar',g:'m'},{name:'Edison',g:'m'},{name:'Eduardo',g:'m'},{name:'Emmanuel',g:'m'},{name:'Enrique',g:'m'},{name:'Enzo',g:'m'},{name:'Evan',g:'m'},{name:'Ezra',g:'m'},
    {name:'Emery',g:'n'},{name:'Elliot',g:'n'},{name:'Echo',g:'n'},{name:'Ember',g:'n'},{name:'Ever',g:'n'},
  ], trait: ['Eager','Earnest','Empathetic','Energetic','Enthusiastic','Expressive','Extraordinary','Excellent','Evolving','Enduring','Electric','Elevated','Engaged','Essential','Evolving'] },
  F: { first: [
    {name:'Faith',g:'f'},{name:'Florence',g:'f'},{name:'Freya',g:'f'},{name:'Fiona',g:'f'},{name:'Felicity',g:'f'},
    {name:'Farida',g:'f'},{name:'Fernanda',g:'f'},{name:'Francesca',g:'f'},{name:'Frida',g:'f'},{name:'Fatima',g:'f'},{name:'Flor',g:'f'},
    {name:'Felix',g:'m'},{name:'Finn',g:'m'},{name:'Francisco',g:'m'},{name:'Freddie',g:'m'},{name:'Flynn',g:'m'},
    {name:'Fabian',g:'m'},{name:'Fernando',g:'m'},{name:'Fletcher',g:'m'},{name:'Foster',g:'m'},{name:'Franco',g:'m'},{name:'Franklin',g:'m'},
    {name:'Frankie',g:'n'},{name:'Finley',g:'n'},{name:'Fern',g:'n'},{name:'Fallon',g:'n'},
  ], trait: ['Fearless','Focused','Forthright','Friendly','Fulfilled','Fantastic','Flourishing','Forgiving','Forward','Fierce','Free','Fresh','Fulfilled','Fueled','Faithful'] },
  G: { first: [
    {name:'Gabriela',g:'f'},{name:'Gianna',g:'f'},{name:'Grace',g:'f'},{name:'Greta',g:'f'},{name:'Gloria',g:'f'},
    {name:'Gemma',g:'f'},{name:'Georgia',g:'f'},{name:'Gracie',g:'f'},{name:'Guadalupe',g:'f'},{name:'Gwen',g:'f'},{name:'Giselle',g:'f'},{name:'Giovanna',g:'f'},
    {name:'Gage',g:'m'},{name:'Gideon',g:'m'},{name:'Grant',g:'m'},{name:'Grayson',g:'m'},{name:'Garrett',g:'m'},
    {name:'Gabriel',g:'m'},{name:'Gavin',g:'m'},{name:'George',g:'m'},{name:'Giovanni',g:'m'},{name:'Graham',g:'m'},{name:'Guillermo',g:'m'},{name:'Gunner',g:'m'},
    {name:'Genesis',g:'n'},{name:'Gray',g:'n'},{name:'Grove',g:'n'},
  ], trait: ['Generous','Gentle','Gifted','Glowing','Gracious','Grateful','Grounded','Genuine','Growing','Gleaming','Giving','Gallant','Gaining','Glorious','Guiding'] },
  H: { first: [
    {name:'Hannah',g:'f'},{name:'Hazel',g:'f'},{name:'Hope',g:'f'},{name:'Holly',g:'f'},{name:'Hana',g:'f'},
    {name:'Hailey',g:'f'},{name:'Harriet',g:'f'},{name:'Helena',g:'f'},{name:'Heaven',g:'f'},{name:'Hilda',g:'f'},{name:'Honoria',g:'f'},
    {name:'Harrison',g:'m'},{name:'Henry',g:'m'},{name:'Hudson',g:'m'},{name:'Hugo',g:'m'},{name:'Hector',g:'m'},
    {name:'Hakeem',g:'m'},{name:'Harold',g:'m'},{name:'Hassan',g:'m'},{name:'Heath',g:'m'},{name:'Henrique',g:'m'},{name:'Howard',g:'m'},
    {name:'Harley',g:'n'},{name:'Harper',g:'n'},{name:'Hayden',g:'n'},{name:'Hunter',g:'n'},{name:'Haven',g:'n'},
  ], trait: ['Happy','Hardworking','Harmonious','Helpful','Honest','Hopeful','Humble','Heroic','Heartfelt','Healing','Hands-on','Hearty','High-achieving','Holistic','Hunger-driven'] },
  I: { first: [
    {name:'Ida',g:'f'},{name:'Ines',g:'f'},{name:'Isabella',g:'f'},{name:'Ivy',g:'f'},{name:'Iris',g:'f'},
    {name:'Imara',g:'f'},{name:'India',g:'f'},{name:'Indira',g:'f'},{name:'Irene',g:'f'},{name:'Isa',g:'f'},{name:'Isadora',g:'f'},{name:'Itzel',g:'f'},
    {name:'Ian',g:'m'},{name:'Isaac',g:'m'},{name:'Isaiah',g:'m'},{name:'Ivan',g:'m'},{name:'Ignacio',g:'m'},
    {name:'Ibrahim',g:'m'},{name:'Idris',g:'m'},{name:'Isaias',g:'m'},{name:'Isidro',g:'m'},{name:'Ignatius',g:'m'},
    {name:'Imani',g:'n'},{name:'Indigo',g:'n'},{name:'Indie',g:'n'},
  ], trait: ['Imaginative','Inclusive','Independent','Industrious','Innovative','Insightful','Inspired','Intuitive','Impactful','Inquisitive','Illuminating','Influential','Intentional','Invested','Incredible'] },
  J: { first: [
    {name:'Jade',g:'f'},{name:'Jasmine',g:'f'},{name:'Jenna',g:'f'},{name:'Joy',g:'f'},{name:'Juniper',g:'f'},{name:'Julia',g:'f'},
    {name:'Jacqueline',g:'f'},{name:'Jada',g:'f'},{name:'Jamila',g:'f'},{name:'Janelle',g:'f'},{name:'Jocelyn',g:'f'},{name:'Josephine',g:'f'},{name:'Juanita',g:'f'},{name:'Juliana',g:'f'},
    {name:'Javier',g:'m'},{name:'Jayden',g:'m'},{name:'Julian',g:'m'},{name:'Jonas',g:'m'},{name:'Joel',g:'m'},
    {name:'Jack',g:'m'},{name:'Jacob',g:'m'},{name:'Jaime',g:'m'},{name:'Jalen',g:'m'},{name:'James',g:'m'},{name:'Jarvis',g:'m'},{name:'Jason',g:'m'},{name:'Joaquin',g:'m'},{name:'Jose',g:'m'},{name:'Juan',g:'m'},
    {name:'Jesse',g:'n'},{name:'Jordan',g:'n'},{name:'Jamie',g:'n'},{name:'Jazz',g:'n'},{name:'Juneau',g:'n'},
  ], trait: ['Joyful','Jubilant','Just','Jovial','Judicious','Journeying','Jazzy','Justified','Joyous','Jumping','Jazzed','Jewel','Joined','Journeyed','Juiced'] },
  K: { first: [
    {name:'Kamila',g:'f'},{name:'Karen',g:'f'},{name:'Keisha',g:'f'},{name:'Kira',g:'f'},{name:'Kylie',g:'f'},
    {name:'Kaia',g:'f'},{name:'Kalani',g:'f'},{name:'Karla',g:'f'},{name:'Katelyn',g:'f'},{name:'Katrina',g:'f'},{name:'Kendra',g:'f'},{name:'Kiara',g:'f'},
    {name:'Keanu',g:'m'},{name:'Kevin',g:'m'},{name:'Kyle',g:'m'},{name:'Kane',g:'m'},{name:'Knox',g:'m'},
    {name:'Kaleb',g:'m'},{name:'Kendrick',g:'m'},{name:'Kenneth',g:'m'},{name:'Khalil',g:'m'},{name:'Kofi',g:'m'},{name:'Kristian',g:'m'},
    {name:'Kai',g:'n'},{name:'Kelly',g:'n'},{name:'Kennedy',g:'n'},{name:'Kim',g:'n'},{name:'Kit',g:'n'},
  ], trait: ['Kind','Keen','Kindhearted','Knowledgeable','Kickstarting','Kaleidoscopic','Knowing','Kindling','Key','Kingly','Kindred','Knack','Knockout','Kudos','Kinetic'] },
  L: { first: [
    {name:'Lana',g:'f'},{name:'Laura',g:'f'},{name:'Lauren',g:'f'},{name:'Layla',g:'f'},{name:'Lexi',g:'f'},{name:'Lily',g:'f'},{name:'Luna',g:'f'},
    {name:'Laila',g:'f'},{name:'Lara',g:'f'},{name:'Larissa',g:'f'},{name:'Latoya',g:'f'},{name:'Leah',g:'f'},{name:'Leticia',g:'f'},{name:'Liliana',g:'f'},{name:'Lourdes',g:'f'},
    {name:'Leo',g:'m'},{name:'Liam',g:'m'},{name:'Lucas',g:'m'},{name:'Luca',g:'m'},{name:'Lance',g:'m'},
    {name:'Landon',g:'m'},{name:'Lawrence',g:'m'},{name:'Leroy',g:'m'},{name:'Lionel',g:'m'},{name:'Lorenzo',g:'m'},{name:'Luis',g:'m'},{name:'Luke',g:'m'},
    {name:'Logan',g:'n'},{name:'Lennon',g:'n'},{name:'Lake',g:'n'},{name:'Lark',g:'n'},
  ], trait: ['Lively','Loyal','Luminous','Loving','Likable','Lighthearted','Leading','Legendary','Limitless','Lifting','Lively','Lasting','Launching','Leaping','Limitbreaking'] },
  M: { first: [
    {name:'Makayla',g:'f'},{name:'Maria',g:'f'},{name:'Maya',g:'f'},{name:'Mia',g:'f'},{name:'Mikaela',g:'f'},{name:'Melody',g:'f'},
    {name:'Marisol',g:'f'},{name:'Mariana',g:'f'},{name:'Marlena',g:'f'},{name:'Megan',g:'f'},{name:'Mercedes',g:'f'},{name:'Michelle',g:'f'},{name:'Miriam',g:'f'},{name:'Monica',g:'f'},
    {name:'Maddox',g:'m'},{name:'Marcus',g:'m'},{name:'Mason',g:'m'},{name:'Miles',g:'m'},{name:'Myles',g:'m'},{name:'Miguel',g:'m'},
    {name:'Malcolm',g:'m'},{name:'Manuel',g:'m'},{name:'Mario',g:'m'},{name:'Martin',g:'m'},{name:'Matthew',g:'m'},{name:'Maurice',g:'m'},{name:'Maxwell',g:'m'},
    {name:'Morgan',g:'n'},{name:'Micah',g:'n'},{name:'Monroe',g:'n'},{name:'Moss',g:'n'},
  ], trait: ['Magnificent','Mindful','Motivated','Marvelous','Meaningful','Mighty','Masterful','Magnetic','Maturing','Mentoring','Making-moves','Measured','Merciful','Mending','Moonlit'] },
  N: { first: [
    {name:'Nadia',g:'f'},{name:'Natalie',g:'f'},{name:'Nicole',g:'f'},{name:'Nora',g:'f'},{name:'Nova',g:'f'},{name:'Nyla',g:'f'},
    {name:'Nadine',g:'f'},{name:'Naomi',g:'f'},{name:'Natasha',g:'f'},{name:'Nia',g:'f'},{name:'Nina',g:'f'},{name:'Nkechi',g:'f'},
    {name:'Nathan',g:'m'},{name:'Noah',g:'m'},{name:'Nico',g:'m'},{name:'Noel',g:'m'},{name:'Niko',g:'m'},
    {name:'Nasir',g:'m'},{name:'Neil',g:'m'},{name:'Nelson',g:'m'},{name:'Nicholas',g:'m'},{name:'Nigel',g:'m'},{name:'Nino',g:'m'},
    {name:'Naveen',g:'n'},{name:'Navy',g:'n'},{name:'North',g:'n'},
  ], trait: ['Natural','Nurturing','Noble','Notable','Nice','Nimble','Nifty','Noteworthy','Nourishing','Navigating','Needed','Networked','New','Next-level','Neighborly'] },
  O: { first: [
    {name:'Olivia',g:'f'},{name:'Ona',g:'f'},{name:'Odessa',g:'f'},{name:'Opal',g:'f'},
    {name:'Odette',g:'f'},{name:'Olga',g:'f'},{name:'Olympia',g:'f'},{name:'Ondina',g:'f'},{name:'Orla',g:'f'},
    {name:'Obi',g:'m'},{name:'Omar',g:'m'},{name:'Orlando',g:'m'},{name:'Oscar',g:'m'},{name:'Owen',g:'m'},{name:'Orion',g:'m'},
    {name:'Obinna',g:'m'},{name:'Octavio',g:'m'},{name:'Olu',g:'m'},{name:'Oran',g:'m'},{name:'Otis',g:'m'},
    {name:'Ocean',g:'n'},{name:'Oakley',g:'n'},{name:'Onyx',g:'n'},
  ], trait: ['Open','Optimistic','Original','Outstanding','Outgoing','Openhearted','Observant','Organic','Overcoming','Owning','Onto-it','Outshining','Outstanding','Onward','One-of-a-kind'] },
  P: { first: [
    {name:'Paige',g:'f'},{name:'Penelope',g:'f'},{name:'Phoebe',g:'f'},{name:'Priya',g:'f'},{name:'Paloma',g:'f'},{name:'Pia',g:'f'},
    {name:'Patricia',g:'f'},{name:'Paula',g:'f'},{name:'Pearl',g:'f'},{name:'Perla',g:'f'},{name:'Petra',g:'f'},{name:'Pilar',g:'f'},
    {name:'Patrick',g:'m'},{name:'Pierce',g:'m'},{name:'Pablo',g:'m'},{name:'Preston',g:'m'},
    {name:'Pedro',g:'m'},{name:'Percy',g:'m'},{name:'Philip',g:'m'},{name:'Phoenix',g:'m'},{name:'Primo',g:'m'},{name:'Prince',g:'m'},
    {name:'Parker',g:'n'},{name:'Peyton',g:'n'},{name:'Pax',g:'n'},{name:'Pine',g:'n'},
  ], trait: ['Patient','Peaceful','Persistent','Playful','Positive','Powerful','Proactive','Proud','Purpose-driven','Promising','Passionate','Polished','Principled','Progressive','Pioneering'] },
  Q: { first: [
    {name:'Queen',g:'f'},{name:'Quinella',g:'f'},{name:'Questa',g:'f'},{name:'Quiana',g:'f'},
    {name:'Quincy',g:'m'},{name:'Quentin',g:'m'},{name:'Quest',g:'m'},{name:'Quillan',g:'m'},
    {name:'Quinn',g:'n'},{name:'Quill',g:'n'},
  ], trait: ['Quick','Qualified','Quality','Quirky','Questioning','Quintessential','Questing','Quiet-strength','Quickwitted','Quenching'] },
  R: { first: [
    {name:'Rachel',g:'f'},{name:'Rosa',g:'f'},{name:'Rosalind',g:'f'},{name:'Ruby',g:'f'},
    {name:'Raquel',g:'f'},{name:'Rebecca',g:'f'},{name:'Renata',g:'f'},{name:'Rhea',g:'f'},{name:'Rita',g:'f'},{name:'Rosario',g:'f'},{name:'Roxanne',g:'f'},{name:'Ruth',g:'f'},
    {name:'Rafael',g:'m'},{name:'Ramon',g:'m'},{name:'Ricardo',g:'m'},{name:'Roman',g:'m'},{name:'Ryder',g:'m'},
    {name:'Raul',g:'m'},{name:'Raymond',g:'m'},{name:'Reggie',g:'m'},{name:'Reginald',g:'m'},{name:'Reuben',g:'m'},{name:'Rex',g:'m'},{name:'Rodrigo',g:'m'},{name:'Roland',g:'m'},
    {name:'Reagan',g:'n'},{name:'Reese',g:'n'},{name:'Riley',g:'n'},{name:'River',g:'n'},{name:'Robin',g:'n'},{name:'Ryan',g:'n'},
  ], trait: ['Radiant','Reliable','Resilient','Resourceful','Respectful','Remarkable','Righteous','Rising','Reaching','Rooted','Ready','Real','Refreshing','Relentless','Rewarding'] },
  S: { first: [
    {name:'Sadie',g:'f'},{name:'Sara',g:'f'},{name:'Savannah',g:'f'},{name:'Selena',g:'f'},{name:'Siena',g:'f'},{name:'Sofia',g:'f'},{name:'Summer',g:'f'},{name:'Stella',g:'f'},
    {name:'Sandra',g:'f'},{name:'Serena',g:'f'},{name:'Shakira',g:'f'},{name:'Shannon',g:'f'},{name:'Shayla',g:'f'},{name:'Simone',g:'f'},{name:'Sonia',g:'f'},{name:'Stacy',g:'f'},
    {name:'Sebastian',g:'m'},{name:'Sergio',g:'m'},{name:'Simon',g:'m'},{name:'Sterling',g:'m'},
    {name:'Samuel',g:'m'},{name:'Santiago',g:'m'},{name:'Scott',g:'m'},{name:'Sean',g:'m'},{name:'Seth',g:'m'},{name:'Solomon',g:'m'},{name:'Stefan',g:'m'},{name:'Steven',g:'m'},
    {name:'Sam',g:'n'},{name:'Skylar',g:'n'},{name:'Sage',g:'n'},{name:'Scout',g:'n'},{name:'Storm',g:'n'},
  ], trait: ['Sincere','Smart','Spirited','Splendid','Stellar','Strong','Supportive','Steadfast','Shining','Soaring','Selfless','Serene','Sharp','Skilled','Soulful'] },
  T: { first: [
    {name:'Talia',g:'f'},{name:'Tia',g:'f'},{name:'Tori',g:'f'},{name:'Tyra',g:'f'},{name:'Thea',g:'f'},
    {name:'Tamara',g:'f'},{name:'Tamika',g:'f'},{name:'Tatiana',g:'f'},{name:'Teresa',g:'f'},{name:'Tiffany',g:'f'},{name:'Trinity',g:'f'},{name:'Trisha',g:'f'},
    {name:'Theodore',g:'m'},{name:'Tobias',g:'m'},{name:'Tommy',g:'m'},{name:'Tristan',g:'m'},{name:'Tyler',g:'m'},{name:'Tanner',g:'m'},
    {name:'Talon',g:'m'},{name:'Tariq',g:'m'},{name:'Terrence',g:'m'},{name:'Thomas',g:'m'},{name:'Titus',g:'m'},{name:'Travis',g:'m'},{name:'Trevor',g:'m'},
    {name:'Taylor',g:'n'},{name:'Tatum',g:'n'},{name:'Trace',g:'n'},{name:'True',g:'n'},
  ], trait: ['Talented','Thoughtful','Thriving','Tenacious','Trustworthy','Terrific','Transformative','True','Trailblazing','Touching','Tireless','Together','Tops','Transcendent','Triumph'] },
  U: { first: [
    {name:'Uma',g:'f'},{name:'Ursula',g:'f'},{name:'Ulani',g:'f'},{name:'Usha',g:'f'},{name:'Undine',g:'f'},
    {name:'Uri',g:'m'},{name:'Umberto',g:'m'},{name:'Upton',g:'m'},{name:'Usher',g:'m'},{name:'Uziel',g:'m'},
    {name:'Unique',g:'n'},{name:'Unity',g:'n'},
  ], trait: ['Understanding','United','Upbeat','Uplifting','Unifying','Unstoppable','Unwavering','Upstanding','Unbounded','Unique','Universal','Unyielding'] },
  V: { first: [
    {name:'Valencia',g:'f'},{name:'Valentina',g:'f'},{name:'Victoria',g:'f'},{name:'Violet',g:'f'},{name:'Vivian',g:'f'},
    {name:'Valeria',g:'f'},{name:'Vanessa',g:'f'},{name:'Veronica',g:'f'},{name:'Viviana',g:'f'},{name:'Vera',g:'f'},
    {name:'Victor',g:'m'},{name:'Vincent',g:'m'},{name:'Vance',g:'m'},{name:'Vito',g:'m'},
    {name:'Valentino',g:'m'},{name:'Vicente',g:'m'},{name:'Viktor',g:'m'},{name:'Virgil',g:'m'},{name:'Vuong',g:'m'},
    {name:'Val',g:'n'},{name:'Vesper',g:'n'},{name:'Verse',g:'n'},
  ], trait: ['Vibrant','Victorious','Visionary','Vivid','Valuable','Versatile','Valiant','Virtuous','Venturing','Vital','Validated','Vast','Venerable','Vibrating','Vocal'] },
  W: { first: [
    {name:'Willow',g:'f'},{name:'Whitney',g:'f'},{name:'Willa',g:'f'},
    {name:'Waverly',g:'f'},{name:'Wendy',g:'f'},{name:'Winona',g:'f'},{name:'Wilda',g:'f'},{name:'Wisteria',g:'f'},
    {name:'Wade',g:'m'},{name:'Wesley',g:'m'},{name:'Wyatt',g:'m'},{name:'Warren',g:'m'},{name:'Winston',g:'m'},
    {name:'Walter',g:'m'},{name:'Wayne',g:'m'},{name:'Wendell',g:'m'},{name:'Wilhelm',g:'m'},{name:'Will',g:'m'},{name:'Willis',g:'m'},
    {name:'Winter',g:'n'},{name:'Wren',g:'n'},{name:'West',g:'n'},{name:'Wild',g:'n'},
  ], trait: ['Warm','Wise','Wonderful','Witty','Worthy','Welcoming','Wholesome','Winning','Willing','Wide-open','Watchful','Whole','Woven','Wowing','Waking'] },
  X: { first: [
    {name:'Xena',g:'f'},{name:'Xiomara',g:'f'},{name:'Xochi',g:'f'},{name:'Ximena',g:'f'},
    {name:'Xander',g:'m'},{name:'Xavier',g:'m'},{name:'Xavi',g:'m'},{name:'Xerxes',g:'m'},
    {name:'Xen',g:'n'},{name:'Xo',g:'n'},
  ], trait: ['Xenial','Extraordinary','Exceptional','Excellent','Expressive','Exploring','Exciting','Expansive','Extra','X-factor'] },
  Y: { first: [
    {name:'Yasmine',g:'f'},{name:'Yolanda',g:'f'},{name:'Yvonne',g:'f'},{name:'Yara',g:'f'},{name:'Yesenia',g:'f'},{name:'Yuki',g:'f'},
    {name:'Yusuf',g:'m'},{name:'Yogi',g:'m'},{name:'Yahya',g:'m'},{name:'Yosef',g:'m'},{name:'Yuma',g:'m'},
    {name:'Yael',g:'n'},{name:'Yori',g:'n'},{name:'York',g:'n'},
  ], trait: ['Youthful','Yearning','Yes-minded','Yielding','You-got-this','Yare','Young-hearted','Yesterday-free','Yielding-results','Yellow-sunshine'] },
  Z: { first: [
    {name:'Zara',g:'f'},{name:'Zelda',g:'f'},{name:'Zoey',g:'f'},{name:'Zola',g:'f'},{name:'Zuri',g:'f'},
    {name:'Zahara',g:'f'},{name:'Zena',g:'f'},{name:'Zinnia',g:'f'},{name:'Zoe',g:'f'},
    {name:'Zach',g:'m'},{name:'Zeke',g:'m'},{name:'Zion',g:'m'},{name:'Zane',g:'m'},
    {name:'Zachariah',g:'m'},{name:'Zahir',g:'m'},{name:'Zander',g:'m'},{name:'Zeus',g:'m'},
    {name:'Zen',g:'n'},{name:'Zephyr',g:'n'},{name:'Zero',g:'n'},
  ], trait: ['Zealous','Zestful','Zenful','Zippy','Zappy','Zingy','Zoned-in','Zeal','Zenith','Zero-limits'] },
};

function djb2(str: string, seed = 5381): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

// Columns that must be integers in the DB — coerce or null out unparseable values
// Note: current_grade is TEXT in the DB (holds numbers, "Parent", "Staff", etc.) — not listed here
const INT_COLUMNS = new Set(['harvard_score', 'casel_score', 'harvard_impacter_score', 'casel_impacter_score']);

function sanitizeRow(row: Record<string, unknown>): void {
  for (const col of INT_COLUMNS) {
    if (!(col in row) || row[col] == null) continue;
    const n = Number(row[col]);
    row[col] = Number.isFinite(n) ? n : null;
  }
  // current_grade: store as string; blank/unrecognised values become null
  if ('current_grade' in row && row.current_grade != null) {
    const s = String(row.current_grade).trim();
    row.current_grade = s.length > 0 ? s : null;
  }
}

// contactId: stable per-student ID across forms (raw.contact_id from VideoAsk)
// usedFirstNames: first names already taken in this run + pre-seeded from DB
// gender: 'Female' | 'Male' | '' | null — used to pick gender-appropriate first names
function generateStudentName(
  contactId: string,
  usedFirstNames: Set<string>,
  gender: string | null,
): { firstName: string; lastName: string; email: string } {
  const g = (gender ?? '').toLowerCase();
  const isFemale = g.includes('female') || g === 'f';
  const isMale   = !isFemale && (g.includes('male') || g === 'm');

  const letters = Object.keys(ALLITERATIVE_NAMES);
  const h1 = djb2(contactId);
  const h2 = djb2(contactId + '\x00');

  for (let attempt = 0; attempt < 2000; attempt++) {
    const letter = letters[(h1 + attempt * 11) % letters.length];
    const { first, trait } = ALLITERATIVE_NAMES[letter];

    // Filter to gender-appropriate names; fall back to neutral, then all
    let pool = first.filter(e => isFemale ? e.g === 'f' : isMale ? e.g === 'm' : true);
    if (pool.length === 0) pool = first.filter(e => e.g === 'n');
    if (pool.length === 0) pool = first;

    const firstName = pool[(h2 + attempt * 7) % pool.length].name;
    if (usedFirstNames.has(firstName)) continue; // first name already taken

    const lastName  = trait[(h1 + h2 + attempt * 13) % trait.length];
    usedFirstNames.add(firstName);
    return {
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.impacter.com`,
    };
  }
  // Extreme fallback
  const fb = contactId.slice(0, 6);
  return { firstName: 'Student', lastName: fb, email: `student.${fb}@student.impacter.com` };
}


// ── Types ──────────────────────────────────────────────────────────────────

type NodeRole =
  | { role: 'response'; harvardAttribute?: string; caselAttribute?: string }
  | { role: 'metadata'; targetColumn: string; sourceField: 'transcript' | 'poll_option' }
  | { role: 'skip' };

type NodeRoles = Record<string, NodeRole>; // keyed by node_id

type RunParams = {
  formId: string;
  staticValues: Record<string, string>;
  columnMappings: Record<string, string>;
  dryRun?: boolean;
  nodeRoles?: NodeRoles;
  updateExisting?: boolean;
  regenNames?: boolean; // when true + updateExisting, ignore old DB names and regenerate fresh
};

export type RunResult =
  | { inserted: number; skipped: number; error?: never }
  | { updated: number; inserted: number; error?: never }
  | { wouldInsert: number; wouldSkip: number; totalStepsFetched: number; sample: Record<string, unknown>[]; error?: never }
  | { error: string };

// Core import logic — called by both POST handler and update-all route
export async function runImportCore(params: RunParams): Promise<RunResult> {
  const { formId, staticValues, columnMappings, dryRun, nodeRoles, updateExisting, regenNames } = params;
  if (!formId) return { error: 'formId required' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const impacter = getImpacterClient() as any;

  // 1. Fetch ALL steps for this form using cursor pagination (Supabase default cap = 1,000 rows)
  const steps: Record<string, unknown>[] = [];
  {
    const STEP_PAGE = 1000;
    let lastStepId = '00000000-0000-0000-0000-000000000000';
    while (true) {
      const { data: page, error: stepsErr } = await impacter
        .schema('videoask')
        .from('steps')
        .select('id, interaction_id, form_id, node_id, node_title, node_text, media_type, media_url, share_url, transcript, created_at, raw')
        .eq('form_id', formId)
        .gt('id', lastStepId)
        .order('id', { ascending: true })
        .limit(STEP_PAGE);

      if (stepsErr) return { error: stepsErr.message };
      const rows = (page ?? []) as Record<string, unknown>[];
      steps.push(...rows);
      if (rows.length < STEP_PAGE) break;
      lastStepId = String(rows[rows.length - 1].id);
    }
  }

  // 1b. Build set of UUIDs from this form's steps — used to scope usedFirstNames to this form only.
  //     Pre-seeding from ALL districts would exhaust the name pool (~390 names) with large datasets.
  const formStepUuids = new Set<string>();
  for (const step of steps) {
    const uuid = extractUuid(String(step.media_url ?? ''));
    if (uuid) formStepUuids.add(uuid);
  }

  // 2. Get existing rows to skip/update already-imported responses.
  //    Keyed by media URL uuid (video responses) OR source_id (text/poll with no media_url).
  //    Use cursor-based pagination to avoid statement timeouts on large tables.
  const importedUuids     = new Set<string>();
  const importedSourceIds = new Set<string>();
  const uuidToId     = new Map<string, number>(); // uuid → student_responses.id
  const sourceIdToId = new Map<string, number>(); // source_id → student_responses.id
  const uuidToName   = new Map<string, { firstName: string; lastName: string; email: string }>();
  const usedFirstNames = new Set<string>();
  const SR_PAGE = 1000;
  let lastId = 0;
  while (true) {
    const { data: urlPage, error: urlErr } = await impacter
      .from('student_responses')
      .select('id, url, source_id, first_name, last_name, student_email')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(SR_PAGE);

    if (urlErr) return { error: urlErr.message };

    const rows = (urlPage ?? []) as { id: number; url?: string; source_id?: string; first_name?: string; last_name?: string; student_email?: string }[];
    for (const row of rows) {
      const uuid = extractUuid(row.url ?? '');
      if (uuid) {
        importedUuids.add(uuid);
        uuidToId.set(uuid, row.id);
      }
      if (row.source_id) {
        importedSourceIds.add(row.source_id);
        sourceIdToId.set(row.source_id, row.id);
      }
      if (row.first_name) {
        if (uuid) {
          uuidToName.set(uuid, { firstName: row.first_name, lastName: row.last_name ?? '', email: row.student_email ?? '' });
          if (formStepUuids.has(uuid)) usedFirstNames.add(row.first_name);
        }
      }
    }

    if (rows.length < SR_PAGE) break;
    lastId = rows[rows.length - 1].id;
  }

  // 3. Build rows to insert (or update)
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  // contactIdToName: within a single run, ensures the same contact_id always gets the same name
  // (relevant when a student has multiple response nodes — each is a separate row but same person)
  const contactIdToName = new Map<string, { firstName: string; lastName: string; email: string }>();

  const hasNodeRoles = nodeRoles && Object.keys(nodeRoles).length > 0;

  if (hasNodeRoles) {
    // ── NODE-ROLE MODE: group by interaction_id ──

    // Group steps by interaction_id
    const byInteraction = new Map<string, Record<string, unknown>[]>();
    for (const step of steps) {
      const interactionId = String(step.interaction_id ?? '');
      if (!byInteraction.has(interactionId)) byInteraction.set(interactionId, []);
      byInteraction.get(interactionId)!.push(step);
    }

    for (const [interactionId, interactionSteps] of byInteraction) {
      // a. Collect metadata values for this interaction
      const metadataValues: Record<string, unknown> = {};
      for (const step of interactionSteps) {
        const nodeId = String(step.node_id ?? '');
        const nodeRole = nodeRoles[nodeId];
        if (!nodeRole || nodeRole.role !== 'metadata') continue;
        const { targetColumn, sourceField } = nodeRole;
        if (!SR_COLUMNS.has(targetColumn)) continue;

        let value: unknown = null;
        if (sourceField === 'transcript') {
          value = step.transcript ?? null;
        } else if (sourceField === 'poll_option') {
          const raw = (step.raw ?? {}) as Record<string, unknown>;
          // VideoAsk stores the selected option directly in poll_option_content
          if (typeof raw.poll_option_content === 'string' && raw.poll_option_content) {
            value = raw.poll_option_content;
          } else {
            // Fallback: poll_options only contains the selected option, field is 'content' not 'label'
            const pollOptions = raw.poll_options as Array<{ content?: string; label?: string }> | undefined;
            value = pollOptions?.[0]?.content ?? pollOptions?.[0]?.label ?? null;
          }
        }

        if (value != null) {
          metadataValues[targetColumn] = value;
        }
      }

      // b. Build a row for each response-role step in this interaction
      for (const step of interactionSteps) {
        const nodeId = String(step.node_id ?? '');
        const nodeRole = nodeRoles[nodeId];
        if (!nodeRole || nodeRole.role !== 'response') continue;

        // Dedup check — by media URL uuid (video) or source_id (text/poll)
        const mediaUrl = String(step.media_url ?? '');
        const uuid = extractUuid(mediaUrl);
        const stepSourceId = String(step.id ?? '');
        const alreadyImported = !!(uuid && importedUuids.has(uuid)) || !!(stepSourceId && importedSourceIds.has(stepSourceId));
        if (!updateExisting && alreadyImported) { skipped++; continue; }

        const row: Record<string, unknown> = {};

        // Apply static values first
        for (const [col, val] of Object.entries(staticValues ?? {})) {
          if (SR_COLUMNS.has(col)) row[col] = val;
        }

        // Apply column mappings
        for (const [srCol, stepCol] of Object.entries(columnMappings ?? {})) {
          if (!SR_COLUMNS.has(srCol) || !stepCol) continue;
          if (stepCol.startsWith('raw.')) {
            const rawKey = stepCol.slice(4);
            const raw = (step.raw ?? {}) as Record<string, unknown>;
            if (raw[rawKey] !== undefined && raw[rawKey] !== null) {
              row[srCol] = raw[rawKey];
            }
          } else if (step[stepCol] !== undefined && step[stepCol] !== null) {
            row[srCol] = step[stepCol];
          }
        }

        // Always ensure url is populated from media_url
        if (!row.url && mediaUrl) row.url = mediaUrl;

        // Always capture source_id from VideoAsk step id (unique per step, used for dedup of text/poll rows)
        if (!row.source_id && step.id) row.source_id = step.id;

        // Normalize VideoAsk media_type → human-readable response_type
        if (row.response_type) row.response_type = normalizeResponseType(String(row.response_type), mediaUrl);

        // Fallback: if question not set by mapping, use node_title
        if (!row.question && step.node_title) row.question = step.node_title;

        // Overlay interaction metadata (only fills gaps — explicit mappings take precedence)
        for (const [col, val] of Object.entries(metadataValues)) {
          if (row[col] === undefined || row[col] === null || row[col] === '') {
            row[col] = val;
          }
        }

        // Apply per-node Harvard/CASEL attributes (only if not already set by mappings)
        if (nodeRole.harvardAttribute && !row.harvard_attribute) {
          row.harvard_attribute = nodeRole.harvardAttribute;
        }
        if (nodeRole.caselAttribute && !row.casel_attribute) {
          row.casel_attribute = nodeRole.caselAttribute;
        }

        // Auto-generate alliterative name — gender-aware, globally unique first name
        if (!row.first_name && !row.last_name && !row.student_email) {
          const contactId = String(
            (interactionSteps[0]?.raw as Record<string, unknown> | undefined)?.contact_id
            ?? interactionId
          );
          // 1. Already imported under a different question node → reuse same name
          //    (skipped when regenNames=true — forces fresh gender-aware generation)
          const existingByUrl = (!regenNames && uuid) ? uuidToName.get(uuid) : undefined;
          // 2. Same contact_id seen earlier in this run → reuse (always active, ensures same student = same name)
          const existingByContact = contactIdToName.get(contactId);
          // 3. Generate fresh
          const resolved = existingByUrl ?? existingByContact
            ?? generateStudentName(contactId, usedFirstNames, String(row.gender ?? metadataValues.gender ?? ''));
          if (!existingByContact) contactIdToName.set(contactId, resolved);
          row.first_name    = resolved.firstName;
          row.last_name     = resolved.lastName;
          row.student_email = resolved.email;
        }

        sanitizeRow(row);
        toInsert.push(row);
      }
    }
  } else {
    // ── FLAT MODE: one row per step (original logic) ──
    for (const step of steps) {
      const mediaUrl = String(step.media_url ?? '');
      const uuid = extractUuid(mediaUrl);
      const stepSourceId = String(step.id ?? '');
      const alreadyImported = !!(uuid && importedUuids.has(uuid)) || !!(stepSourceId && importedSourceIds.has(stepSourceId));
      if (!updateExisting && alreadyImported) { skipped++; continue; }

      const row: Record<string, unknown> = {};

      // Apply static values first
      for (const [col, val] of Object.entries(staticValues ?? {})) {
        if (SR_COLUMNS.has(col)) row[col] = val;
      }

      // Apply column mappings: srColumn → videoask step column (or raw sub-field)
      for (const [srCol, stepCol] of Object.entries(columnMappings ?? {})) {
        if (!SR_COLUMNS.has(srCol) || !stepCol) continue;

        // Support "raw.field_name" to pull from the raw JSONB
        if (stepCol.startsWith('raw.')) {
          const rawKey = stepCol.slice(4);
          const raw = (step.raw ?? {}) as Record<string, unknown>;
          if (raw[rawKey] !== undefined && raw[rawKey] !== null) {
            row[srCol] = raw[rawKey];
          }
        } else if (step[stepCol] !== undefined && step[stepCol] !== null) {
          row[srCol] = step[stepCol];
        }
      }

      // Always ensure url is populated from media_url
      if (!row.url && mediaUrl) row.url = mediaUrl;

      // Always capture source_id from VideoAsk step id (unique per step, used for dedup of text/poll rows)
      if (!row.source_id && step.id) row.source_id = step.id;

      // Normalize VideoAsk media_type → human-readable response_type
      if (row.response_type) row.response_type = normalizeResponseType(String(row.response_type));

      // Fallback: if question not set by mapping, use node_title
      if (!row.question && step.node_title) row.question = step.node_title;

      // Auto-generate alliterative name — gender-aware, globally unique first name
      if (!row.first_name && !row.last_name && !row.student_email) {
        const contactId = String(
          (step.raw as Record<string, unknown> | undefined)?.contact_id
          ?? step.interaction_id
          ?? step.id
          ?? ''
        );
        const uuid = extractUuid(String(step.media_url ?? ''));
        const existingByUrl     = (!regenNames && uuid) ? uuidToName.get(uuid) : undefined;
        const existingByContact = contactIdToName.get(contactId);
        const resolved = existingByUrl ?? existingByContact
          ?? generateStudentName(contactId, usedFirstNames, String(row.gender ?? ''));
        if (!existingByContact) contactIdToName.set(contactId, resolved);
        row.first_name    = resolved.firstName;
        row.last_name     = resolved.lastName;
        row.student_email = resolved.email;
      }

      sanitizeRow(row);
      toInsert.push(row);
    }
  }

  if (dryRun) {
    return { wouldInsert: toInsert.length, wouldSkip: skipped, totalStepsFetched: steps.length, sample: toInsert.slice(0, 3) };
  }

  // 4a. SYNC mode — update existing rows AND insert new ones
  if (updateExisting) {
    // Resolve existing row ID by url uuid first, then source_id for text/poll rows
    function resolveRowId(row: Record<string, unknown>): number | undefined {
      const uuid = extractUuid(String(row.url ?? ''));
      if (uuid && uuidToId.has(uuid)) return uuidToId.get(uuid);
      const sid = String(row.source_id ?? '');
      if (sid && sourceIdToId.has(sid)) return sourceIdToId.get(sid);
      return undefined;
    }
    const toUpdate    = toInsert.filter(row => resolveRowId(row) !== undefined);
    const toInsertNew = toInsert.filter(row => resolveRowId(row) === undefined);

    // Update existing rows by primary key
    let updated = 0;
    const BATCH = 20;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const results = await Promise.all(
        toUpdate.slice(i, i + BATCH).map(row => {
          const rowId = resolveRowId(row);
          if (!rowId) return Promise.resolve({ error: null });
          return impacter.from('student_responses').update(row).eq('id', rowId);
        })
      );
      for (const { error } of results as { error: { message: string } | null }[]) {
        if (error) return { error: error.message };
      }
      updated += Math.min(BATCH, toUpdate.length - i);
    }

    // Insert brand-new rows
    let inserted = 0;
    const CHUNK = 100;
    for (let i = 0; i < toInsertNew.length; i += CHUNK) {
      const chunk = toInsertNew.slice(i, i + CHUNK);
      const { error: insertErr } = await impacter.from('student_responses').insert(chunk);
      if (insertErr) return { error: insertErr.message };
      inserted += chunk.length;
    }

    return { updated, inserted };
  }

  // 4b. INSERT new rows in chunks
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error: insertErr } = await impacter.from('student_responses').insert(chunk);
    if (insertErr) return { error: insertErr.message };
    inserted += chunk.length;
  }

  return { inserted, skipped };
}

// POST /api/admin/videoask-import/run
export async function POST(req: Request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = await req.json() as RunParams;
  if (!params.formId) return NextResponse.json({ error: 'formId required' }, { status: 400 });

  const result = await runImportCore(params);
  return NextResponse.json(result, { status: 'error' in result ? 500 : 200 });
}
