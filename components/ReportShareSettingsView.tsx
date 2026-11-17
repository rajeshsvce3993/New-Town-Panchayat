'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Check, ImageIcon, Palette, Share2 } from 'lucide-react';
import type { Language } from './translations';
import { themesConfig, type ThemeType } from '@/lib/themeConfig';
import {
  DEFAULT_IMAGES_TEMPLATE_EN,
  DEFAULT_IMAGES_TEMPLATE_TA,
  REPORT_SHARE_PLACEHOLDERS,
  REPORT_SHARE_PREVIEW_VALUES,
  fillReportShareTemplate,
  reportThemeForId,
  resolveReportShare,
  type ReportTheme,
} from '@/lib/reportShareConfig';
import { sanitizeShareHtml, templateToHtml } from '@/lib/reportShareHtml';
import ReportShareMessageEditor, { type ReportShareMessageEditorHandle } from './ReportShareMessageEditor';

const THEME_CARDS: { id: ThemeType; descEn: string; descTa: string }[] = [
  { id: 'light', descEn: 'Dark-to-light slate', descTa: 'இருள் முதல் வெளிர் ஸ்லேட்' },
  { id: 'dark', descEn: 'Light-to-dark slate', descTa: 'வெளிர் முதல் இருள் ஸ்லேட்' },
  { id: 'ocean-wave', descEn: 'Dark-to-light ocean', descTa: 'இருள் கடல் முதல் வெளிர் டீல்' },
  { id: 'sunset-aurora', descEn: 'Dark-to-light sunset', descTa: 'இருள் ஊதா முதல் வெளிர் அம்பர்' },
  { id: 'magic-lavender', descEn: 'Dark-to-light lavender', descTa: 'இருள் இண்டிகோ முதல் வெளிர் இளஞ்சிவப்பு' },
  { id: 'rainbow-prism', descEn: 'Dark-to-light prism', descTa: 'இருள் நீலம் முதல் வெளிர் சிவப்பு' },
  { id: 'nilgiri-emerald', descEn: 'Dark-to-light emerald', descTa: 'இருள் பச்சை முதல் வெளிர் மரகதம்' },
  { id: 'kovai-maroon', descEn: 'Dark-to-light maroon', descTa: 'இருள் மெரூன் முதல் வெளிர் செம்மண்' },
  { id: 'madurai-blue', descEn: 'Dark-to-light royal blue', descTa: 'இருள் நீலம் முதல் வெளிர் ஊதா' },
  { id: 'nellai-orange', descEn: 'Dark-to-light orange', descTa: 'இருள் ஆரஞ்சு முதல் வெளிர் ஆரஞ்சு' },
  { id: 'chennai-slate', descEn: 'Dark-to-light graphite', descTa: 'இருள் கிராஃபைட் முதல் வெளிர் ஸ்லேட்' },
  { id: 'royal-gold', descEn: 'Dark-to-light gold', descTa: 'இருள் பழுப்பு முதல் வெளிர் பொன்' },
  { id: 'crimson-ruby', descEn: 'Dark-to-light ruby', descTa: 'இருள் சிவப்பு முதல் வெளிர் ரோஜா' },
  { id: 'cyber-teal', descEn: 'Dark-to-light teal', descTa: 'இருள் டீல் முதல் வெளிர் டீல்' },
  { id: 'custom', descEn: 'Uses the custom portal colors', descTa: 'தனிப்பயன் போர்டல் நிறங்கள்' },
];

type FieldKey = 'imagesEn' | 'imagesTa';
type Section = 'theme' | 'message';

function SharePreview({
  title,
  caption,
  imagesOnly,
  enabled,
  theme,
  offLabel,
}: {
  title: string;
  caption: string;
  imagesOnly: boolean;
  enabled: boolean;
  theme: ReportTheme;
  offLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div
        className="px-3 py-2.5 text-center text-[11px] font-semibold text-white"
        style={{ backgroundImage: `linear-gradient(180deg, ${theme.headerFrom}, ${theme.headerMid}, ${theme.headerTo})` }}
      >
        Existing report header
      </div>
      {imagesOnly ? (
        <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-2">
          <div className="h-14 rounded-md bg-white ring-1 ring-slate-200" />
          <div className="h-14 rounded-md bg-white ring-1 ring-slate-200" />
          <div className="h-14 rounded-md bg-white ring-1 ring-slate-200" />
          <div className="h-14 rounded-md bg-white ring-1 ring-slate-200" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-2 text-[10px] font-semibold text-slate-500">
          <div className="flex h-16 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">Images</div>
          <div className="flex h-16 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">Details</div>
        </div>
      )}
      <div
        className="px-3 py-3 text-left text-xs leading-5 [&_p]:mb-2"
        style={{ background: theme.messageBackground, color: theme.messageText }}
        dangerouslySetInnerHTML={{ __html: enabled ? sanitizeShareHtml(templateToHtml(caption)) : offLabel }}
      />
    </section>
  );
}

export default function ReportShareSettingsView({
  state,
  lang,
  onSaveSettings,
}: {
  state: any;
  lang: Language;
  onSaveSettings: (settings: any) => Promise<void>;
}) {
  const current = resolveReportShare(state?.settings);
  const customColors = state?.settings?.customColors;
  const [enabled, setEnabled] = useState(current.enabled);
  const [imagesTemplateEn, setImagesEn] = useState(current.captionTemplateEn);
  const [imagesTemplateTa, setImagesTa] = useState(current.captionTemplateTa);
  const [themeId, setThemeId] = useState(current.themeId || String(state?.settings?.theme || 'nilgiri-emerald'));
  const [messageBackground, setMessageBackground] = useState(current.theme.messageBackground);
  const [messageText, setMessageText] = useState(current.theme.messageText);
  const theme: ReportTheme = { ...reportThemeForId(themeId, customColors), messageBackground, messageText };
  const [section, setSection] = useState<Section>('theme');
  const [active, setActive] = useState<FieldKey>('imagesEn');
  const enEditor = useRef<ReportShareMessageEditorHandle>(null);
  const taEditor = useRef<ReportShareMessageEditorHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ta = lang === 'ta';

  const preview = useMemo(
    () => ({
      imagesEn: fillReportShareTemplate(imagesTemplateEn, REPORT_SHARE_PREVIEW_VALUES),
      imagesTa: fillReportShareTemplate(imagesTemplateTa, REPORT_SHARE_PREVIEW_VALUES),
    }),
    [imagesTemplateEn, imagesTemplateTa]
  );

  const insert = (token: string) => {
    if (active === 'imagesEn') enEditor.current?.insert(token);
    else taEditor.current?.insert(token);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onSaveSettings({
        ...(state?.settings || {}),
        reportShare: {
          enabled,
          captionTemplateEn: imagesTemplateEn,
          captionTemplateTa: imagesTemplateTa,
          imagesTemplateEn,
          imagesTemplateTa,
          detailedTemplateEn: imagesTemplateEn,
          detailedTemplateTa: imagesTemplateTa,
          themeId,
          theme,
        },
      });
      setSaved(true);
    } catch (err) {
      console.error('Report share settings save failed', err);
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const selectedName = ta ? themesConfig[themeId as ThemeType]?.nameTa : themesConfig[themeId as ThemeType]?.nameEn;

  return (
    <div className="portal-studio">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Share2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {ta ? 'அறிக்கை பகிர்வு' : 'Report share'}
            </h3>
            <p className="text-[10px] text-white/70">
              {ta
                ? 'அறிக்கை நிறம் மற்றும் பகிர்வு செய்தியை அமைக்கவும்'
                : 'Set the report theme and the template message sent with each share'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="relative z-[1] rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 disabled:opacity-60"
        >
          {saving ? (ta ? 'சேமிக்கிறது…' : 'Saving…') : saved ? (ta ? 'சேமிக்கப்பட்டது' : 'Saved') : ta ? 'சேமி' : 'Save'}
        </button>
      </div>

      <div className="portal-fis-body portal-page space-y-3">
        <div className="portal-dash-toolbar">
          <div className="portal-dash-pills">
            <button type="button" onClick={() => setSection('theme')} className={`portal-dash-pill ${section === 'theme' ? 'is-active' : ''}`}>
              <Palette className="h-3.5 w-3.5" />
              <span>{ta ? 'தீம்' : 'Theme'}</span>
            </button>
            <button type="button" onClick={() => { setSection('message'); setActive('imagesEn'); }} className={`portal-dash-pill ${section === 'message' ? 'is-active' : ''}`}>
              <ImageIcon className="h-3.5 w-3.5" />
              <span>{ta ? 'வார்ப்புரு செய்தி' : 'Template message'}</span>
            </button>
          </div>
          <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
            <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
            {ta ? 'செய்தியை இயக்கு' : 'Use template message'}
          </label>
        </div>

        {section === 'theme' && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Palette className="h-3 w-3" />
                      </span>
                      {ta ? 'அறிக்கை தீம்' : 'Report theme'}
                    </h3>
                    <p>{ta ? 'தேர்ந்தெடுத்த தீம் அறிக்கை தலைப்பு, அட்டவணை, பொத்தான் மற்றும் பகிர்வு பக்கத்தில் தெரியும்' : 'The selected theme is applied to the report header, table, buttons, and shared page'}</p>
                  </div>
                  {selectedName ? <span className="portal-dash-pill is-active">{selectedName}</span> : null}
                </div>
                <div className="portal-dash-body">
                  <div className="portal-theme-grid">
                    {THEME_CARDS.map((card) => {
                      const conf = themesConfig[card.id];
                      const from = card.id === 'custom' ? (customColors?.sidebarFrom || '#1e293b') : conf.chartGradient[0];
                      const to = card.id === 'custom' ? (customColors?.sidebarTo || '#0f172a') : conf.chartGradient[1];
                      const selected = themeId === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => { setThemeId(card.id); setSaved(false); }}
                          className={`portal-theme-card ${selected ? 'is-active' : ''}`}
                        >
                          <span className="portal-theme-card-bar" style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }} />
                          <span className="portal-theme-card-meta">
                            <span>
                              <strong>{ta ? conf.nameTa : conf.nameEn}</strong>
                              <em>{ta ? card.descTa : card.descEn}</em>
                            </span>
                            {selected && (
                              <span className="portal-theme-card-check">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3 lg:col-span-5">
              <SharePreview title={ta ? 'பட அறிக்கை' : 'Share report'} caption={ta ? preview.imagesTa : preview.imagesEn} imagesOnly enabled={enabled} theme={theme} offLabel={ta ? 'செய்தி அணைக்கப்பட்டுள்ளது' : 'Template off'} />
              <SharePreview title={ta ? 'விரிவான அறிக்கை' : 'Share detailed report'} caption={ta ? preview.imagesTa : preview.imagesEn} imagesOnly={false} enabled={enabled} theme={theme} offLabel={ta ? 'செய்தி அணைக்கப்பட்டுள்ளது' : 'Template off'} />
            </div>
          </div>
        )}

        {section !== 'theme' && (
          <>
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>{ta ? 'செய்தி நிறம்' : 'Message colors'}</h3>
                  <p>{ta ? 'பின்னணி நிறம் முழு செய்திக்கும் பொருந்தும். உரை நிறம் தேர்ந்தெடுத்த சொற்களுக்கு மாற்றலாம்' : 'Background applies to the whole message. Select words to change their size, font, or color'}</p>
                </div>
              </div>
              <div className="portal-dash-body flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  {ta ? 'பின்னணி' : 'Background'}
                  <input type="color" value={messageBackground} onChange={(e) => { setMessageBackground(e.target.value); setSaved(false); }} className="h-8 w-12 cursor-pointer rounded border border-slate-200" />
                </label>
                <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  {ta ? 'இயல்பு உரை' : 'Default text'}
                  <input type="color" value={messageText} onChange={(e) => { setMessageText(e.target.value); setSaved(false); }} className="h-8 w-12 cursor-pointer rounded border border-slate-200" />
                </label>
              </div>
            </div>
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>{ta ? 'இடங்கள்' : 'Placeholders'}</h3>
                  <p>{ta ? 'தேர்ந்தெடுத்த மொழிப் பெட்டியில் சேர்க்கப்படும்' : 'Inserted into the message box you are editing'}</p>
                </div>
              </div>
              <div className="portal-dash-body flex flex-wrap gap-1.5">
                {REPORT_SHARE_PLACEHOLDERS.map((token) => (
                  <button key={token} type="button" className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-white" onClick={() => insert(token)}>
                    {token}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <ReportShareMessageEditor ref={enEditor} title="English" value={imagesTemplateEn} active={active === 'imagesEn'} background={messageBackground} color={messageText} onChange={(v) => { setImagesEn(v); setSaved(false); }} onFocus={() => setActive('imagesEn')} onReset={() => setImagesEn(DEFAULT_IMAGES_TEMPLATE_EN)} resetLabel={ta ? 'மீட்டமை' : 'Reset'} />
              <ReportShareMessageEditor ref={taEditor} title="தமிழ்" value={imagesTemplateTa} active={active === 'imagesTa'} background={messageBackground} color={messageText} onChange={(v) => { setImagesTa(v); setSaved(false); }} onFocus={() => setActive('imagesTa')} onReset={() => setImagesTa(DEFAULT_IMAGES_TEMPLATE_TA)} resetLabel={ta ? 'மீட்டமை' : 'Reset'} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <SharePreview
                title="Share report · English"
                caption={preview.imagesEn}
                imagesOnly
                enabled={enabled}
                theme={theme}
                offLabel="Template off"
              />
              <SharePreview
                title="Share report · Tamil"
                caption={preview.imagesTa}
                imagesOnly
                enabled={enabled}
                theme={theme}
                offLabel="Template off"
              />
              <SharePreview
                title="Share detailed report · English"
                caption={preview.imagesEn}
                imagesOnly={false}
                enabled={enabled}
                theme={theme}
                offLabel="Template off"
              />
              <SharePreview
                title="Share detailed report · Tamil"
                caption={preview.imagesTa}
                imagesOnly={false}
                enabled={enabled}
                theme={theme}
                offLabel="Template off"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
