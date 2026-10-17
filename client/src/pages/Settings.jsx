const Group = ({ legend, name, value, onChange, options, hint }) => (
  <fieldset className="card"><legend className="px-1 font-serif text-xl">{legend}</legend>
    <div className="mt-2 flex flex-wrap gap-2">{options.map(([v, l]) => (
      <label key={v} className={`cursor-pointer rounded-md border px-4 py-2 text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-gold ${value === v ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand'}`}>
        <input type="radio" className="sr-only" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />{l}</label>))}</div>
    {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}</fieldset>
);
export default function Settings({ prefs, setPrefs, reset }) {
  const set = (k) => (v) => setPrefs({ ...prefs, [k]: v });
  return (
    <section className="space-y-6"><div><h1 className="text-4xl">Settings</h1><p className="text-muted">Comfort and accessibility options. They apply instantly and are saved on this device.</p></div>
      <Group legend="Theme" name="theme" value={prefs.theme} onChange={set('theme')} options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my device']]} hint="Match my device follows your system light or dark setting." />
      <Group legend="Text size" name="size" value={prefs.size} onChange={set('size')} options={[['md', 'Standard'], ['lg', 'Large'], ['xl', 'Extra large']]} />
      <Group legend="Contrast" name="contrast" value={prefs.contrast} onChange={set('contrast')} options={[['normal', 'Standard'], ['high', 'Higher contrast']]} hint="Strengthens borders and secondary text." />
      <Group legend="Motion" name="motion" value={prefs.motion} onChange={set('motion')} options={[['on', 'Full animations'], ['off', 'Reduced motion']]} hint="Reduced motion removes entrance effects, hover lifts and the score animation. It starts on if your device asks for less motion." />
      <div className="card"><h2 className="font-serif text-xl">Preview</h2><p className="mt-2">Thoughtfully considered. Personally introduced.</p><p className="text-sm text-muted">Secondary text appears like this.</p></div>
      <div className="card text-sm"><h2 className="font-serif text-xl">Privacy in introductions</h2>
        <p className="mt-2"><b>Shared with a match:</b> first name, age, city, designation, short bio, relationship intention, interests.</p>
        <p className="mt-1"><b>Always private:</b> phone, email, income, caste, religion, family details and internal notes.</p>
        <p className="mt-2 text-xs text-muted">Verification here is a prototype check with a mock code; it is not confirmation from a real provider.</p></div>
      <button className="btn" onClick={reset}>Reset to defaults</button>
    </section>
  );
}
