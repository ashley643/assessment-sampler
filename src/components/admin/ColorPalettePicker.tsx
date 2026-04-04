'use client';

export interface ColorValues {
  accent_color: string;
  badge_bg: string;
  badge_text: string;
}

const PALETTES: (ColorValues & { name: string })[] = [
  { name: 'Ocean',    accent_color: '#4a6fa5', badge_bg: '#E6F1FB', badge_text: '#0C447C' },
  { name: 'Coral',    accent_color: '#e8735a', badge_bg: '#FAECE7', badge_text: '#712B13' },
  { name: 'Forest',   accent_color: '#1D9E75', badge_bg: '#E3F5EF', badge_text: '#0A5C40' },
  { name: 'Plum',     accent_color: '#7B5EA7', badge_bg: '#EEE8F5', badge_text: '#3D1F6B' },
  { name: 'Teal',     accent_color: '#2A9D8F', badge_bg: '#E0F4F2', badge_text: '#0D5F58' },
  { name: 'Amber',    accent_color: '#D4900A', badge_bg: '#FDF3E3', badge_text: '#7A4F10' },
  { name: 'Rose',     accent_color: '#C75A7A', badge_bg: '#FAEAED', badge_text: '#7A1F34' },
  { name: 'Indigo',   accent_color: '#5C6BC0', badge_bg: '#ECEEF9', badge_text: '#1A237E' },
  { name: 'Sage',     accent_color: '#5E9B7A', badge_bg: '#E8F4EE', badge_text: '#1F5C3A' },
  { name: 'Slate',    accent_color: '#607D8B', badge_bg: '#ECEFF1', badge_text: '#1C3340' },
];

interface Props {
  values: ColorValues;
  onChange: (v: ColorValues) => void;
}

export default function ColorPalettePicker({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Suggested palettes */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Suggested palettes</p>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map(p => {
            const active = values.accent_color === p.accent_color;
            return (
              <button
                key={p.name}
                type="button"
                title={p.name}
                onClick={() => onChange({ accent_color: p.accent_color, badge_bg: p.badge_bg, badge_text: p.badge_text })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                  active
                    ? 'border-[#4a6fa5] ring-1 ring-[#4a6fa5] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.accent_color }} />
                <span className="font-semibold px-1.5 py-0.5 rounded-full text-xs" style={{ background: p.badge_bg, color: p.badge_text }}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual overrides */}
      <details className="group">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none list-none flex items-center gap-1">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="currentColor">
            <path d="M4 2l5 4-5 4V2z"/>
          </svg>
          Custom hex values
        </summary>
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
          {([
            { label: 'Accent', key: 'accent_color' as const },
            { label: 'Badge BG', key: 'badge_bg' as const },
            { label: 'Badge Text', key: 'badge_text' as const },
          ]).map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="color"
                  value={values[key]}
                  onChange={e => onChange({ ...values, [key]: e.target.value })}
                  className="h-8 w-9 p-0.5 border border-gray-300 rounded cursor-pointer flex-shrink-0"
                />
                <input
                  value={values[key]}
                  onChange={e => onChange({ ...values, [key]: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Live preview */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Preview:</span>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: values.accent_color }} />
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: values.badge_bg, color: values.badge_text }}>
          Label
        </span>
      </div>
    </div>
  );
}
