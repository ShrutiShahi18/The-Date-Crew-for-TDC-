// Deterministic synthetic profiles (seeded PRNG). All people, emails and phones are fictional.
const FEM = ['Aanya','Diya','Ishita','Kavya','Meera','Nisha','Riya','Saanvi','Tara','Anika','Pooja','Neha','Sneha','Ritika','Mansi','Aditi','Bhavna','Charu','Deepa','Esha','Fiza','Gauri','Harini','Isha','Jhanvi','Kriti','Lavanya','Mitali','Navya','Ojasvi'];
const MALE = ['Arjun','Rohan','Vikram','Karan','Aarav','Dev','Ishaan','Kabir','Nikhil','Rahul','Siddharth','Tushar','Yash','Varun','Aman','Bhaskar','Chirag','Dhruv','Eshan','Farhan','Gaurav','Harsh','Imran','Jatin','Kunal','Lakshya','Manav','Neil','Om','Pranav'];
const LAST = ['Sharma','Iyer','Menon','Kapoor','Reddy','Banerjee','Khan','Gill','Nair','Desai','Joshi','Mehta','Rao','Chatterjee','Bose','Singh','Verma','Pillai','Shetty','Kulkarni','Das','Mishra','Thakur','Bhatt','Sethi','Ghosh','Agarwal','Naidu','Fernandes','Pandey'];
const CITIES = ['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Jaipur','Lucknow','Chandigarh','Kochi','Indore','Bhubaneswar','Gorakhpur'];
const COLLEGES = ['IIT Delhi','NIT Trichy','BITS Pilani','Delhi University','Christ University','IIM Indore','Symbiosis Pune','Jadavpur University','Anna University','AIIMS Delhi','NLU Bhopal','IIIT Hyderabad','Manipal University'];
const DEGREES = ['B.Tech','MBBS','B.Com','MBA','B.Des','LLB','M.Sc','B.A.','CA'];
const JOBS = [['Software Engineer','Infosys'],['Product Manager','Flipkart'],['Doctor','Apollo Hospitals'],['Chartered Accountant','Deloitte'],['Architect','Studio Prism'],['Teacher','DPS'],['Data Analyst','Razorpay'],['Entrepreneur','Own venture'],['Lawyer','Khaitan & Co'],['Designer','Swiggy'],['Civil Servant','Government of India'],['Researcher','IISc']];
const LANGS = ['Hindi','English','Tamil','Telugu','Bengali','Marathi','Gujarati','Kannada','Malayalam','Punjabi'];
const INTERESTS = ['reading','hiking','cooking','classical music','cricket','travel','photography','yoga','films','board games','painting','running','gardening','theatre'];
const INTENTS = ['marriage','marriage','long-term','long-term','open'];
const YMM = ['Yes','No','Maybe'];

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildProfiles() {
  const r = rng(2026);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const some = (a, n) => [...a].sort(() => r() - 0.5).slice(0, n);
  const chance = (p) => r() < p;
  const used = new Set(); const out = [];
  const make = (gender, i, role) => {
    let first, last; do { first = pick(gender === 'Female' ? FEM : MALE); last = pick(LAST); } while (used.has(first + last));
    used.add(first + last);
    const age = int(24, 38), city = pick(CITIES), [designation, company] = pick(JOBS);
    const dob = `${2026 - age}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
    const interests = some(INTERESTS, int(2, 4));
    const complete = chance(0.8);
    const p = {
      role, status: 'active', seed: true, firstName: first, lastName: last, gender, dob, country: 'India', city,
      email: `${first}.${last}.${i}@example.invalid`.toLowerCase(), phone: `+91 90000 ${String(10000 + i)}`,
      college: pick(COLLEGES), degree: pick(DEGREES), company, designation, maritalStatus: chance(0.93) ? 'Never married' : 'Divorced',
      languages: some(LANGS, int(1, 3)), interests, siblings: int(0, 3), verified: chance(0.7),
      bio: `${designation} in ${city}. Enjoys ${interests.slice(0, 2).join(' and ')}.`,
    };
    if (complete || chance(0.4)) p.heightCm = gender === 'Female' ? int(150, 175) : int(163, 190);
    if (complete || chance(0.4)) p.income = int(4, 45); // LPA
    if (complete || chance(0.5)) { p.wantsChildren = pick(YMM); p.openToRelocation = pick(YMM); p.openToPets = pick(YMM); p.intention = pick(INTENTS); }
    if (chance(0.5)) p.religion = pick(['Hindu','Muslim','Christian','Sikh','Jain','Spiritual']);
    if (chance(0.7)) {
      const prefs = { ageMin: age - int(3, 7), ageMax: age + int(3, 7) };
      if (chance(0.3)) prefs.heightMin = int(150, 172);
      if (chance(0.25)) prefs.incomeMin = int(4, 18);
      if (chance(0.35)) prefs.cities = some(CITIES, 3).concat(city);
      if (chance(0.25)) prefs.hard = [pick(['age', 'children'])];
      p.prefs = prefs;
    }
    out.push(p);
  };
  let i = 0;
  for (let k = 0; k < 110; k++) make('Female', i++, 'candidate');
  for (let k = 0; k < 110; k++) make('Male', i++, 'candidate');
  for (const g of ['Male', 'Female', 'Male', 'Female']) make(g, i++, 'customer');
  return out;
}
