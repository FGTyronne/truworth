import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase, startAuthRefreshLifecycle } from './lib/supabase';
import { labelForScore, score, verdictForScore, type Motive, type ScoreInput } from './lib/scoring';

type Screen = 'home' | 'assess' | 'library' | 'insights' | 'account' | 'result';

type Assessment = {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  source_url: string | null;
  canonical_url: string | null;
  image_url: string | null;
  observed_price: number | null;
  currency: string;
  score: number;
  score_version: string;
  inputs: ScoreInput;
  status: string;
  created_at: string;
};

type Purchase = { assessment_id: string; purchased_at: string; actual_uses: number; actual_joy: number | null };
type Subscription = {
  tier: string;
  status: string;
  plan_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  trial_end?: string | null;
  trial_notice_acknowledged_at?: string | null;
};

const COLORS = {
  bg: '#FCF9F4', ink: '#101B4D', muted: '#68708A', green: '#15C39A', greenDark: '#0DAA84',
  greenSoft: '#DDF8F0', card: '#FFFFFF', line: '#E8E8EC', peach: '#FFF0E7', lilac: '#F1EBFF',
  blue: '#E7F2FF', yellow: '#FFF5C8', red: '#B42318', redSoft: '#FEE4E2'
};
const HERO = 'https://truworth.vercel.app/assets/hero-products.webp?v=20261009i';
const WEB_PLANS = 'https://truworth.vercel.app/plans.html';
const WEB_HOW = 'https://truworth.vercel.app/decision-support.html';

const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const purchaseId = () => `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function SectionTitle({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return <View style={styles.sectionTitle}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.sectionH2}>{title}</Text>{copy ? <Text style={styles.sectionCopy}>{copy}</Text> : null}</View>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.buttonPressed]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, destructive && styles.dangerButton, pressed && styles.buttonPressed]}><Text style={[styles.secondaryButtonText, destructive && styles.dangerText]}>{label}</Text></Pressable>;
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, secure = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'url' | 'email-address'; multiline?: boolean; secure?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9A9FB1" keyboardType={keyboardType} secureTextEntry={secure} autoCapitalize={secure || keyboardType === 'email-address' || keyboardType === 'url' ? 'none' : 'sentences'} autoCorrect={false} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

function ScoreBadge({ value }: { value: number }) {
  return <View style={styles.scoreBadge}><Text style={styles.scoreBadgeNumber}>{value}</Text><Text style={styles.scoreBadgeLabel}>{labelForScore(value)}</Text></View>;
}

function BottomNav({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const tabs: Array<[Screen, string, string]> = [['home', '⌂', 'Home'], ['assess', '＋', 'Assess'], ['library', '▤', 'Library'], ['insights', '▥', 'Insights'], ['account', '○', 'Account']];
  return <View style={styles.bottomNav}>{tabs.map(([key, icon, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: screen === key }} onPress={() => setScreen(key)} style={styles.tab}><Text style={[styles.tabIcon, screen === key && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, screen === key && styles.tabActive]}>{label}</Text></Pressable>)}</View>;
}

function HomeScreen({ session, assessments, purchases, onAssess, onResult }: { session: Session | null; assessments: Assessment[]; purchases: Record<string, Purchase>; onAssess: () => void; onResult: (item: Assessment) => void }) {
  const average = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + Number(item.score), 0) / assessments.length) : 0;
  const bought = assessments.filter((item) => item.status === 'purchased' || purchases[item.id]).length;
  const categories = [['🎧', 'Tech'], ['👟', 'Fashion'], ['☕', 'Home'], ['🧴', 'Beauty'], ['🏋️', 'Fitness'], ['🎮', 'Gaming']];
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <View style={styles.heroCard}>
      <Text style={styles.eyebrow}>A quick check before you buy</Text>
      <Text style={styles.heroTitle}>Before you buy,{`\n`}<Text style={styles.heroAccent}>check if it’s worth it.</Text></Text>
      <Text style={styles.heroCopy}>Check products like headphones, phones, trainers, bags, skincare and home tech. TruWorth gives you a clear score based on the details you enter.</Text>
      <PrimaryButton label="Start assessment →" onPress={onAssess} />
      <View style={styles.proofRow}><Text style={styles.proof}>✓ No account needed</Text><Text style={styles.proof}>✓ About 2 minutes</Text><Text style={styles.proof}>✓ Clear 0–100 score</Text></View>
      <Image source={{ uri: HERO }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1.18, borderRadius: 20, backgroundColor: '#F7F7F4', marginTop: 2 }} accessibilityLabel="Examples of everyday products" />
    </View>

    <View style={styles.statGrid}>
      <View style={styles.statCard}><Text style={styles.statNumber}>{assessments.length || '—'}</Text><Text style={styles.statLabel}>Saved</Text></View>
      <View style={styles.statCard}><Text style={styles.statNumber}>{bought || '—'}</Text><Text style={styles.statLabel}>Bought</Text></View>
      <View style={styles.statCard}><Text style={styles.statNumber}>{assessments.length ? average : '—'}</Text><Text style={styles.statLabel}>Avg score</Text></View>
    </View>

    <SectionTitle eyebrow="Popular categories" title="What are you considering?" copy="Tech, fashion, home, beauty, fitness and gaming products." />
    <View style={styles.categoryGrid}>{categories.map(([icon, label], index) => <Pressable key={label} onPress={onAssess} style={[styles.category, [styles.catMint, styles.catBlue, styles.catPeach, styles.catLilac, styles.catYellow, styles.catMint][index]]}><Text style={styles.categoryIcon}>{icon}</Text><Text style={styles.categoryText}>{label}</Text></Pressable>)}</View>

    <SectionTitle eyebrow={assessments.length ? 'Your activity' : 'Start here'} title={assessments.length ? 'Recent purchases you considered' : 'Use a product you genuinely want'} />
    {assessments.length ? assessments.slice(0, 4).map((item) => <Pressable key={item.id} onPress={() => onResult(item)} style={styles.listCard}><View style={styles.listCopy}><Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.listMeta}>{[item.brand, item.observed_price != null ? money(Number(item.observed_price), item.currency) : null].filter(Boolean).join(' · ')}</Text></View><ScoreBadge value={Number(item.score)} /></Pressable>) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{session ? 'Your library is empty' : 'Try TruWorth before creating an account'}</Text><Text style={styles.emptyCopy}>{session ? 'Complete your first assessment and it will be saved to your account.' : 'You can calculate a score without signing in. Sign in when you want results saved across devices.'}</Text><SecondaryButton label="Assess a product" onPress={onAssess} /></View>}
  </ScrollView>;
}

type Draft = { item: string; brand: string; retailer: string; source_url: string; price: string; upkeep: string; uses: string; effort: string; joy: number; minutes: string; hourValue: string; motive: Motive; alternative: string };
const blankDraft = (): Draft => ({ item: '', brand: '', retailer: '', source_url: '', price: '', upkeep: '0', uses: '50', effort: '0', joy: 5, minutes: '0', hourValue: '15', motive: 'need', alternative: '' });

function AssessScreen({ signedIn, onSubmit, onImport }: { signedIn: boolean; onSubmit: (input: ScoreInput) => Promise<void>; onImport: (url: string) => Promise<Partial<Draft>> }) {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const importLink = async () => {
    if (!draft.source_url.trim()) { setMessage('Paste a retailer product link first.'); return; }
    if (!signedIn) { setMessage('Sign in to import product details automatically, or enter them manually.'); return; }
    setImporting(true); setMessage('');
    try { const values = await onImport(draft.source_url.trim()); setDraft((current) => ({ ...current, ...values })); setMessage('Product details imported. Check them before scoring.'); }
    catch { setMessage('We could not import that page. You can still complete the assessment manually.'); }
    finally { setImporting(false); }
  };

  const submit = async () => {
    const input: ScoreInput = { item: draft.item.trim(), brand: draft.brand.trim(), retailer: draft.retailer.trim(), source_url: draft.source_url.trim(), price: Number(draft.price), upkeep: Number(draft.upkeep), uses: Number(draft.uses), effort: Number(draft.effort), joy: draft.joy, minutes: Number(draft.minutes), hourValue: Number(draft.hourValue), motive: draft.motive, alternative: draft.alternative.trim(), currency: 'GBP' };
    try { score(input); setSaving(true); setMessage(''); await onSubmit(input); setDraft(blankDraft()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Check the purchase details and try again.'); }
    finally { setSaving(false); }
  };

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <SectionTitle eyebrow="New assessment" title="What are you thinking of buying?" copy="Use a physical product: headphones, trainers, skincare, a coffee machine, a bag, a controller or similar." />
    <View style={styles.formCard}>
      <Field label="Product" value={draft.item} onChangeText={(v) => set('item', v)} placeholder="e.g. Sony WH-1000XM6" />
      <View style={styles.twoCol}><View style={styles.half}><Field label="Brand (optional)" value={draft.brand} onChangeText={(v) => set('brand', v)} placeholder="Sony" /></View><View style={styles.half}><Field label="Retailer (optional)" value={draft.retailer} onChangeText={(v) => set('retailer', v)} placeholder="John Lewis" /></View></View>
      <Field label="Retailer product link (optional)" value={draft.source_url} onChangeText={(v) => set('source_url', v)} placeholder="https://seller.com/product" keyboardType="url" />
      {draft.source_url ? <SecondaryButton label={importing ? 'Importing…' : 'Import product details'} onPress={importLink} /> : null}
      <View style={styles.twoCol}><View style={styles.half}><Field label="Price (£)" value={draft.price} onChangeText={(v) => set('price', v)} placeholder="299.00" keyboardType="decimal-pad" /></View><View style={styles.half}><Field label="Extra lifetime costs (£)" value={draft.upkeep} onChangeText={(v) => set('upkeep', v)} keyboardType="decimal-pad" /></View></View>
    </View>

    <View style={styles.formCard}>
      <Text style={styles.formHeading}>How you will use it</Text>
      <View style={styles.twoCol}><View style={styles.half}><Field label="Expected uses" value={draft.uses} onChangeText={(v) => set('uses', v)} keyboardType="numeric" /></View><View style={styles.half}><Field label="Setup & upkeep hours" value={draft.effort} onChangeText={(v) => set('effort', v)} keyboardType="decimal-pad" /></View></View>
      <Text style={styles.fieldLabel}>Enjoyment after the novelty wears off · {draft.joy}/10</Text>
      <View style={styles.joyRow}>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <Pressable key={value} onPress={() => set('joy', value)} style={[styles.joyButton, draft.joy === value && styles.joyActive]}><Text style={[styles.joyText, draft.joy === value && styles.joyTextActive]}>{value}</Text></Pressable>)}</View>
      <View style={styles.twoCol}><View style={styles.half}><Field label="Minutes saved per use" value={draft.minutes} onChangeText={(v) => set('minutes', v)} keyboardType="numeric" /></View><View style={styles.half}><Field label="Value of an hour (£)" value={draft.hourValue} onChangeText={(v) => set('hourValue', v)} keyboardType="decimal-pad" /></View></View>
    </View>

    <View style={styles.formCard}>
      <Text style={styles.formHeading}>Why you want it</Text>
      <View style={styles.motiveRow}>{([['need', 'Useful'], ['joy', 'Enjoyment'], ['image', 'Impulse']] as Array<[Motive, string]>).map(([value, label]) => <Pressable key={value} onPress={() => set('motive', value)} style={[styles.motive, draft.motive === value && styles.motiveActive]}><Text style={[styles.motiveText, draft.motive === value && styles.motiveTextActive]}>{label}</Text></Pressable>)}</View>
      <Field label="Alternative you already have (optional)" value={draft.alternative} onChangeText={(v) => set('alternative', v)} placeholder="e.g. my current headphones" />
      <View style={styles.tip}><Text style={styles.tipIcon}>💡</Text><Text style={styles.tipText}>Would you still want this in 30 days? Be realistic about how much you will actually use it.</Text></View>
      {message ? <Text style={styles.formMessage}>{message}</Text> : null}
      <PrimaryButton label={saving ? 'Calculating…' : 'See my result →'} onPress={submit} disabled={saving} />
      {!signedIn ? <Text style={styles.inlineNote}>Your result will stay only in this app session unless you sign in and save it.</Text> : null}
    </View>
  </ScrollView></KeyboardAvoidingView>;
}

function ResultScreen({ item, saved, onBack }: { item: Assessment; saved: boolean; onBack: () => void }) {
  const metrics = score({ ...item.inputs, item: item.title });
  const cautious = score({ ...item.inputs, item: item.title, uses: Math.max(1, Math.round(Number(item.inputs.uses) / 2)), joy: Math.max(1, Number(item.inputs.joy) - 2) });
  const verdict = verdictForScore(Number(item.score));
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <Pressable onPress={onBack}><Text style={styles.backText}>‹ Back</Text></Pressable>
    <View style={styles.resultHero}><View style={styles.scoreCircle}><Text style={styles.scoreCircleNumber}>{item.score}</Text><Text style={styles.scoreCircleSmall}>/ 100</Text></View><View style={styles.resultCopy}><Text style={styles.eyebrow}>Your TruWorth result</Text><Text style={styles.resultTitle}>{verdict.title}</Text><Text style={styles.resultBody}>{verdict.body}</Text></View></View>
    <View style={styles.resultProduct}><View style={styles.listCopy}><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.listMeta}>{[item.brand, item.retailer].filter(Boolean).join(' · ') || 'Product assessment'}</Text></View>{item.observed_price != null ? <Text style={styles.resultPrice}>{money(Number(item.observed_price), item.currency)}</Text> : null}</View>
    <View style={styles.metricGrid}><View style={styles.metric}><Text style={styles.metricLabel}>Cost per use</Text><Text style={styles.metricValue}>{money(metrics.perUse, item.currency)}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>Estimated total</Text><Text style={styles.metricValue}>{money(metrics.total, item.currency)}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>Planned uses</Text><Text style={styles.metricValue}>{item.inputs.uses}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>Enjoyment</Text><Text style={styles.metricValue}>{item.inputs.joy}/10</Text></View></View>
    <View style={styles.formCard}><Text style={styles.formHeading}>Stress test</Text><Text style={styles.sectionCopy}>If you use it half as often and enjoy it two points less, the score moves from {item.score} to {cautious.score}.</Text></View>
    <View style={styles.formCard}><Text style={styles.formHeading}>Before you buy</Text><Text style={styles.checkLine}>↔ Compare one similar product.</Text><Text style={styles.checkLine}>⏳ Give it 24 hours if the purchase is not urgent.</Text><Text style={styles.checkLine}>♻ Check whether used or refurbished gives you the same utility for less.</Text></View>
    <Text style={styles.inlineNote}>{saved ? 'Saved to your TruWorth account.' : 'This result is not stored. Sign in before your next assessment if you want it saved.'}</Text>
  </ScrollView>;
}

function LibraryScreen({ session, assessments, onResult, onAccount, refreshing, refresh }: { session: Session | null; assessments: Assessment[]; onResult: (item: Assessment) => void; onAccount: () => void; refreshing: boolean; refresh: () => void }) {
  if (!session) return <ScrollView contentContainerStyle={styles.scrollContent}><SectionTitle eyebrow="Library" title="Sign in to build your purchase history" copy="Saved assessments live in your TruWorth account, not in ordinary device storage." /><PrimaryButton label="Sign in" onPress={onAccount} /></ScrollView>;
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><SectionTitle eyebrow="Your product library" title="Saved assessments" copy="Cloud-backed and available on your signed-in devices." />{assessments.length ? assessments.map((item) => <Pressable key={item.id} onPress={() => onResult(item)} style={styles.listCard}><View style={styles.listCopy}><Text style={styles.listTitle}>{item.title}</Text><Text style={styles.listMeta}>{[item.brand, item.observed_price != null ? money(Number(item.observed_price), item.currency) : null].filter(Boolean).join(' · ')}</Text></View><ScoreBadge value={Number(item.score)} /></Pressable>) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No saved products yet</Text><Text style={styles.emptyCopy}>Complete an assessment and it will appear here.</Text></View>}</ScrollView>;
}

function InsightsScreen({ session, assessments, purchases, onAccount }: { session: Session | null; assessments: Assessment[]; purchases: Record<string, Purchase>; onAccount: () => void }) {
  if (!session) return <ScrollView contentContainerStyle={styles.scrollContent}><SectionTitle eyebrow="Insights" title="Your patterns need an account" copy="Sign in so TruWorth can compare your saved assessments and purchases over time." /><PrimaryButton label="Sign in" onPress={onAccount} /></ScrollView>;
  const purchased = assessments.filter((item) => item.status === 'purchased' || purchases[item.id]);
  const average = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + Number(item.score), 0) / assessments.length) : 0;
  const total = assessments.reduce((sum, item) => sum + Number(item.observed_price || 0), 0);
  const best = [...assessments].sort((a, b) => Number(b.score) - Number(a.score))[0];
  return <ScrollView contentContainerStyle={styles.scrollContent}><SectionTitle eyebrow="Your patterns" title="Insights" copy="Built from the products you assess and later buy." /><View style={styles.statGrid}><View style={styles.statCard}><Text style={styles.statNumber}>{assessments.length ? average : '—'}</Text><Text style={styles.statLabel}>Avg score</Text></View><View style={styles.statCard}><Text style={styles.statNumber}>{purchased.length}</Text><Text style={styles.statLabel}>Bought</Text></View><View style={styles.statCard}><Text style={styles.statNumber}>{money(total)}</Text><Text style={styles.statLabel}>Considered</Text></View></View>{best ? <View style={styles.formCard}><Text style={styles.eyebrow}>Strongest saved match</Text><Text style={styles.resultTitle}>{best.title}</Text><Text style={styles.sectionCopy}>Score {best.score}/100 · {labelForScore(best.score)}</Text></View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Your insights will build over time</Text><Text style={styles.emptyCopy}>Save a few assessments and TruWorth will start showing useful patterns.</Text></View>}</ScrollView>;
}

function AuthCard({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    if (!email.trim() || password.length < (mode === 'signup' ? 8 : 6)) { setMessage(mode === 'signup' ? 'Use a valid email and a password of at least 8 characters.' : 'Enter your email and password.'); return; }
    setBusy(true); setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        onSignedIn();
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setMessage(data.session ? 'Account created and signed in.' : 'Account created. Check your email to confirm it, then sign in here.');
        if (data.session) onSignedIn();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'We could not complete that request.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.authCard}><View style={styles.authSwitch}><Pressable onPress={() => setMode('login')} style={[styles.authTab, mode === 'login' && styles.authTabActive]}><Text style={[styles.authTabText, mode === 'login' && styles.authTabTextActive]}>Sign in</Text></Pressable><Pressable onPress={() => setMode('signup')} style={[styles.authTab, mode === 'signup' && styles.authTabActive]}><Text style={[styles.authTabText, mode === 'signup' && styles.authTabTextActive]}>Create account</Text></Pressable></View><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" /><Field label="Password" value={password} onChangeText={setPassword} placeholder={mode === 'signup' ? '8+ characters' : 'Your password'} secure />{message ? <Text style={styles.formMessage}>{message}</Text> : null}<PrimaryButton label={busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} disabled={busy} /></View>;
}

function AccountScreen({ session, subscription, assessments, purchases, onRefresh, onCancelTrial }: { session: Session | null; subscription: Subscription; assessments: Assessment[]; purchases: Record<string, Purchase>; onRefresh: () => void; onCancelTrial: () => void }) {
  if (!session) return <ScrollView contentContainerStyle={styles.scrollContent}><SectionTitle eyebrow="Account" title="Save your decisions across devices" copy="Sign in to keep your saved assessments and purchase history synced across devices." /><AuthCard onSignedIn={onRefresh} /><Pressable onPress={() => Linking.openURL(WEB_HOW)}><Text style={styles.linkText}>How TruWorth works →</Text></Pressable></ScrollView>;
  const plus = subscription.tier === 'plus' && ['active', 'trialing'].includes(subscription.status);
  const trial = subscription.status === 'trialing';
  const bought = assessments.filter((item) => item.status === 'purchased' || purchases[item.id]).length;
  const average = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + Number(item.score), 0) / assessments.length) : null;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <SectionTitle eyebrow="Account" title="Your TruWorth account" />
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(session.user.email || 'T').charAt(0).toUpperCase()}</Text></View><View style={styles.profileCopy}><Text style={styles.profileLabel}>Signed in as</Text><Text style={styles.profileEmail} selectable>{session.user.email}</Text></View><View style={[styles.planBadge, plus && styles.planBadgePlus]}><Text style={[styles.planBadgeText, plus && styles.planBadgeTextPlus]}>{trial ? 'Trial' : plus ? 'TruWorth+' : 'Free'}</Text></View></View>
    <View style={styles.statGrid}><View style={styles.statCard}><Text style={styles.statNumber}>{assessments.length}</Text><Text style={styles.statLabel}>Saved</Text></View><View style={styles.statCard}><Text style={styles.statNumber}>{bought}</Text><Text style={styles.statLabel}>Bought</Text></View><View style={styles.statCard}><Text style={styles.statNumber}>{average ?? '—'}</Text><Text style={styles.statLabel}>Avg score</Text></View></View>
    <View style={styles.formCard}><Text style={styles.eyebrow}>Your plan</Text><Text style={styles.resultTitle}>{trial ? 'TruWorth+ 3-day trial' : plus ? 'TruWorth+' : 'Free account'}</Text><Text style={styles.sectionCopy}>{trial ? `Full access is active until ${dateTime(subscription.trial_end || subscription.current_period_end)}.` : plus ? 'Unlimited purchase history and TruWorth+ guidance are active.' : `${Math.min(assessments.length, 10)} of 10 Free saved-product slots used.`}</Text>{!plus ? <><Text style={styles.checkLine}>✓ Up to 10 saved assessments</Text><Text style={styles.checkLine}>✓ Cloud sync</Text><Text style={styles.checkLine}>✓ Saved-product comparisons</Text><Text style={styles.checkLine}>✓ Purchase tracking</Text></> : <><Text style={styles.checkLine}>✓ Unlimited saved assessments</Text><Text style={styles.checkLine}>✓ Buyer Profile</Text><Text style={styles.checkLine}>✓ BUY / DON’T BUY guidance</Text></>}{trial && !subscription.cancel_at_period_end ? <SecondaryButton label="Cancel trial" onPress={onCancelTrial} destructive /> : null}{trial && subscription.cancel_at_period_end ? <Text style={styles.cancelledNote}>Cancellation is scheduled for the trial end. No first subscription payment will be taken.</Text> : null}<SecondaryButton label={plus ? 'Membership details' : 'View TruWorth+'} onPress={() => Linking.openURL(WEB_PLANS)} /></View>
    <View style={styles.formCard}><Text style={styles.formHeading}>Account controls</Text><SecondaryButton label="How TruWorth works" onPress={() => Linking.openURL(WEB_HOW)} /><SecondaryButton label="Sign out" onPress={async () => { await supabase.auth.signOut(); }} /></View>
  </ScrollView>;
}

function TrialReview({ visible, subscription, onClose, onAction }: { visible: boolean; subscription: Subscription; onClose: () => void; onAction: (action: 'acknowledge' | 'cancel') => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const annual = subscription.plan_interval === 'year';
  const price = annual ? '£59.99 per year' : '£5.99 per month';
  const act = async (action: 'acknowledge' | 'cancel') => { setBusy(true); setMessage(''); try { await onAction(action); onClose(); } catch { setMessage('We could not update your trial. Try again.'); } finally { setBusy(false); } };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalLayer}><View style={styles.modalCard}><Text style={styles.eyebrow}>Trial reminder</Text><Text style={styles.modalTitle}>Your 3-day trial ends tomorrow</Text><Text style={styles.sectionCopy}>Your {price} subscription is due to start on {dateTime(subscription.trial_end || subscription.current_period_end)}.</Text><View style={styles.paymentCard}><Text style={styles.profileLabel}>Next payment</Text><Text style={styles.paymentValue}>{price}</Text></View><Text style={styles.sectionCopy}>Choose whether to keep TruWorth+ or cancel before billing starts.</Text>{message ? <Text style={styles.formMessage}>{message}</Text> : null}<PrimaryButton label={busy ? 'Saving…' : 'Keep TruWorth+'} onPress={() => act('acknowledge')} disabled={busy} /><SecondaryButton label="Cancel trial" onPress={() => act('cancel')} destructive /><Pressable onPress={onClose}><Text style={styles.modalLater}>Not now</Text></Pressable></View></View></Modal>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [purchases, setPurchases] = useState<Record<string, Purchase>>({});
  const [subscription, setSubscription] = useState<Subscription>({ tier: 'free', status: 'active' });
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [selectedSaved, setSelectedSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trialReview, setTrialReview] = useState(false);

  const loadCloud = useCallback(async (current: Session | null, showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    if (!current?.user) { setAssessments([]); setPurchases({}); setSubscription({ tier: 'free', status: 'active' }); setRefreshing(false); return; }
    try {
      const [assessmentResult, purchaseResult, subscriptionResult] = await Promise.all([
        supabase.from('assessments').select('*').order('created_at', { ascending: false }),
        supabase.from('purchase_tracking').select('*'),
        supabase.from('subscriptions').select('*').eq('user_id', current.user.id).maybeSingle()
      ]);
      if (assessmentResult.error) throw assessmentResult.error;
      if (purchaseResult.error) throw purchaseResult.error;
      setAssessments((assessmentResult.data || []) as Assessment[]);
      setPurchases(Object.fromEntries(((purchaseResult.data || []) as Purchase[]).map((item) => [item.assessment_id, item])));
      setSubscription((subscriptionResult.data as Subscription | null) || { tier: 'free', status: 'active' });
    } catch (error) { console.error('Cloud data load failed', error); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    const stopRefresh = startAuthRefreshLifecycle();
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => { if (!active) return; const next = data.session || null; setSession(next); await loadCloud(next); if (active) setLoading(false); });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); void loadCloud(next); });
    return () => { active = false; authListener.subscription.unsubscribe(); stopRefresh(); };
  }, [loadCloud]);

  const dueTrial = useMemo(() => {
    if (subscription.status !== 'trialing' || subscription.cancel_at_period_end || subscription.trial_notice_acknowledged_at) return false;
    const raw = subscription.trial_end || subscription.current_period_end;
    if (!raw) return false;
    const remaining = new Date(raw).getTime() - Date.now();
    return remaining > 0 && remaining <= 24 * 60 * 60 * 1000;
  }, [subscription]);

  const submitAssessment = async (input: ScoreInput) => {
    const metrics = score(input);
    if (session?.user) {
      const payload = { user_id: session.user.id, title: input.item, brand: input.brand || null, retailer: input.retailer || null, source_url: input.source_url || null, canonical_url: input.canonical_url || null, image_url: input.image_url || null, observed_price: input.price, currency: input.currency || 'GBP', score: metrics.score, score_version: metrics.version, inputs: input, status: 'considering' };
      const { data, error } = await supabase.from('assessments').insert(payload).select('*').single();
      if (error) throw error;
      const record = data as Assessment;
      setAssessments((current) => [record, ...current]); setSelected(record); setSelectedSaved(true); setScreen('result');
    } else {
      const record: Assessment = { id: purchaseId(), title: input.item, brand: input.brand || null, retailer: input.retailer || null, source_url: input.source_url || null, canonical_url: null, image_url: null, observed_price: input.price, currency: input.currency || 'GBP', score: metrics.score, score_version: metrics.version, inputs: input, status: 'considering', created_at: new Date().toISOString() };
      setSelected(record); setSelectedSaved(false); setScreen('result');
    }
  };

  const importProduct = async (url: string): Promise<Partial<Draft>> => {
    const { data, error } = await supabase.functions.invoke('import-product', { body: { url } });
    if (error) throw error;
    return { item: data?.title || '', brand: data?.brand || '', retailer: data?.retailer || '', price: data?.price != null ? String(data.price) : '', source_url: data?.canonical_url || url };
  };

  const openResult = (item: Assessment) => { setSelected(item); setSelectedSaved(Boolean(session)); setScreen('result'); };
  const refresh = () => void loadCloud(session, true);

  const trialAction = async (action: 'acknowledge' | 'cancel') => {
    const { data, error } = await supabase.functions.invoke('trial-action', { body: { action } });
    if (error || !data?.ok) throw error || new Error(data?.error || 'Could not update trial.');
    setSubscription((current) => ({ ...current, trial_notice_acknowledged_at: data.acknowledged_at || new Date().toISOString(), cancel_at_period_end: action === 'cancel' ? true : current.cancel_at_period_end, trial_end: data.access_end || current.trial_end }));
  };

  const confirmCancelTrial = () => Alert.alert('Cancel TruWorth+ trial?', 'You will keep TruWorth+ until the trial ends. No first subscription payment will be taken.', [{ text: 'Keep trial', style: 'cancel' }, { text: 'Cancel trial', style: 'destructive', onPress: () => { void trialAction('cancel').catch(() => Alert.alert('Could not cancel trial', 'Please try again.')); } }]);

  if (loading) return <SafeAreaView style={[styles.safe, styles.center]}><StatusBar style="dark" /><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>Loading TruWorth…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
    <View style={styles.appHeader}><Text style={styles.wordmark}>Tru<Text style={styles.wordmarkAccent}>Worth</Text></Text>{session ? <Text style={styles.headerPlan}>{subscription.status === 'trialing' ? 'Trial' : subscription.tier === 'plus' ? 'Plus' : 'Free'}</Text> : <Text style={styles.headerPlan}>Guest</Text>}</View>
    {dueTrial ? <Pressable onPress={() => setTrialReview(true)} style={styles.trialBanner}><View style={styles.trialBang}><Text style={styles.trialBangText}>!</Text></View><View style={styles.trialBannerCopy}><Text style={styles.trialBannerTitle}>Your trial ends tomorrow</Text><Text style={styles.trialBannerText}>Review it before billing starts.</Text></View><Text style={styles.trialBannerLink}>Review →</Text></Pressable> : null}
    <View style={styles.flex}>
      {screen === 'home' ? <HomeScreen session={session} assessments={assessments} purchases={purchases} onAssess={() => setScreen('assess')} onResult={openResult} /> : null}
      {screen === 'assess' ? <AssessScreen signedIn={Boolean(session)} onSubmit={submitAssessment} onImport={importProduct} /> : null}
      {screen === 'library' ? <LibraryScreen session={session} assessments={assessments} onResult={openResult} onAccount={() => setScreen('account')} refreshing={refreshing} refresh={refresh} /> : null}
      {screen === 'insights' ? <InsightsScreen session={session} assessments={assessments} purchases={purchases} onAccount={() => setScreen('account')} /> : null}
      {screen === 'account' ? <AccountScreen session={session} subscription={subscription} assessments={assessments} purchases={purchases} onRefresh={() => { void supabase.auth.getSession().then(({ data }) => { setSession(data.session); void loadCloud(data.session); }); }} onCancelTrial={confirmCancelTrial} /> : null}
      {screen === 'result' && selected ? <ResultScreen item={selected} saved={selectedSaved} onBack={() => setScreen(selectedSaved ? 'library' : 'home')} /> : null}
    </View>
    <BottomNav screen={screen} setScreen={setScreen} />
    <TrialReview visible={trialReview} subscription={subscription} onClose={() => setTrialReview(false)} onAction={trialAction} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, flex: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center' }, loadingText: { marginTop: 12, color: COLORS.muted, fontWeight: '600' },
  appHeader: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, backgroundColor: COLORS.bg }, wordmark: { fontSize: 24, fontWeight: '900', color: COLORS.ink, letterSpacing: -1 }, wordmarkAccent: { color: COLORS.greenDark }, headerPlan: { fontSize: 12, fontWeight: '800', color: COLORS.ink, backgroundColor: COLORS.greenSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  scrollContent: { padding: 18, paddingBottom: 36, gap: 16 }, sectionTitle: { gap: 5, marginBottom: 2 }, eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 11, fontWeight: '900', color: COLORS.greenDark }, sectionH2: { fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: -0.8, color: COLORS.ink }, sectionCopy: { fontSize: 15, lineHeight: 22, color: COLORS.muted },
  heroCard: { borderRadius: 28, backgroundColor: COLORS.card, padding: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#F0EFEA', gap: 14 }, heroTitle: { fontSize: 36, lineHeight: 39, fontWeight: '900', letterSpacing: -1.5, color: COLORS.ink }, heroAccent: { color: COLORS.greenDark }, heroCopy: { color: COLORS.muted, fontSize: 16, lineHeight: 23 }, heroImage: { width: '100%', aspectRatio: 1.18, borderRadius: 20, backgroundColor: '#F7F7F4', marginTop: 2 }, proofRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, proof: { fontSize: 12, color: COLORS.muted, fontWeight: '700' },
  primaryButton: { backgroundColor: COLORS.green, minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 2 }, primaryButtonText: { color: '#062A23', fontSize: 15, fontWeight: '900' }, secondaryButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#DADDE5', backgroundColor: '#fff', marginTop: 6 }, secondaryButtonText: { fontSize: 14, color: COLORS.ink, fontWeight: '800' }, dangerButton: { borderColor: '#FDA29B', backgroundColor: '#FFF7F6' }, dangerText: { color: COLORS.red }, buttonPressed: { opacity: 0.62 },
  statGrid: { flexDirection: 'row', gap: 9 }, statCard: { flex: 1, minWidth: 0, backgroundColor: COLORS.card, paddingVertical: 16, paddingHorizontal: 10, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: '#F0EFEA' }, statNumber: { fontSize: 20, fontWeight: '900', color: COLORS.ink, textAlign: 'center' }, statLabel: { fontSize: 11, marginTop: 3, color: COLORS.muted, fontWeight: '700', textAlign: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, category: { width: '31%', minHeight: 92, borderRadius: 20, padding: 12, justifyContent: 'space-between' }, categoryIcon: { fontSize: 27 }, categoryText: { color: COLORS.ink, fontWeight: '900', fontSize: 13 }, catMint: { backgroundColor: COLORS.greenSoft }, catBlue: { backgroundColor: COLORS.blue }, catPeach: { backgroundColor: COLORS.peach }, catLilac: { backgroundColor: COLORS.lilac }, catYellow: { backgroundColor: COLORS.yellow },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, padding: 14 }, listCopy: { flex: 1, minWidth: 0 }, listTitle: { color: COLORS.ink, fontWeight: '900', fontSize: 15 }, listMeta: { color: COLORS.muted, fontSize: 12, marginTop: 4 }, scoreBadge: { alignItems: 'flex-end', minWidth: 60 }, scoreBadgeNumber: { color: COLORS.greenDark, fontSize: 22, fontWeight: '900' }, scoreBadgeLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '700' }, emptyCard: { padding: 20, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, gap: 9 }, emptyTitle: { color: COLORS.ink, fontWeight: '900', fontSize: 17 }, emptyCopy: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  formCard: { backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, padding: 17, gap: 14 }, formHeading: { color: COLORS.ink, fontWeight: '900', fontSize: 19 }, field: { gap: 6 }, fieldLabel: { color: COLORS.ink, fontWeight: '800', fontSize: 12 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#D8DBE4', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, color: COLORS.ink, fontSize: 15, backgroundColor: '#FFF' }, multiline: { minHeight: 90, textAlignVertical: 'top' }, twoCol: { flexDirection: 'row', gap: 10 }, half: { flex: 1, minWidth: 0 }, joyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, joyButton: { width: 31, height: 31, borderRadius: 10, borderWidth: 1, borderColor: '#DADDE5', alignItems: 'center', justifyContent: 'center' }, joyActive: { backgroundColor: COLORS.green, borderColor: COLORS.green }, joyText: { color: COLORS.muted, fontWeight: '800' }, joyTextActive: { color: '#07352B' }, motiveRow: { flexDirection: 'row', gap: 8 }, motive: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#DADDE5', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, motiveActive: { backgroundColor: COLORS.greenSoft, borderColor: COLORS.green }, motiveText: { color: COLORS.muted, fontWeight: '800', fontSize: 12 }, motiveTextActive: { color: COLORS.ink }, tip: { flexDirection: 'row', gap: 9, backgroundColor: COLORS.yellow, padding: 12, borderRadius: 15 }, tipIcon: { fontSize: 17 }, tipText: { flex: 1, color: COLORS.ink, fontSize: 12, lineHeight: 17, fontWeight: '600' }, formMessage: { color: COLORS.red, fontSize: 13, lineHeight: 18, fontWeight: '600' }, inlineNote: { color: COLORS.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  backText: { color: COLORS.ink, fontWeight: '800', fontSize: 15, paddingVertical: 5 }, resultHero: { backgroundColor: COLORS.greenSoft, borderRadius: 24, padding: 19, flexDirection: 'row', gap: 16, alignItems: 'center' }, scoreCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#fff', borderWidth: 8, borderColor: COLORS.green, alignItems: 'center', justifyContent: 'center' }, scoreCircleNumber: { color: COLORS.ink, fontSize: 29, fontWeight: '900' }, scoreCircleSmall: { color: COLORS.muted, fontSize: 10 }, resultCopy: { flex: 1, gap: 5 }, resultTitle: { color: COLORS.ink, fontSize: 22, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5 }, resultBody: { color: COLORS.muted, fontSize: 13, lineHeight: 18 }, resultProduct: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, resultPrice: { color: COLORS.ink, fontWeight: '900', fontSize: 16 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metric: { width: '48%', flexGrow: 1, borderRadius: 17, padding: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line }, metricLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' }, metricValue: { color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 4 }, checkLine: { color: COLORS.ink, fontSize: 13, lineHeight: 19 },
  authCard: { backgroundColor: COLORS.card, padding: 17, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, gap: 13 }, authSwitch: { flexDirection: 'row', backgroundColor: '#F2F3F5', borderRadius: 14, padding: 3 }, authTab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, authTabActive: { backgroundColor: '#fff' }, authTabText: { color: COLORS.muted, fontWeight: '800', fontSize: 12 }, authTabTextActive: { color: COLORS.ink }, linkText: { color: COLORS.ink, fontWeight: '800', textAlign: 'center', paddingVertical: 10 },
  profileCard: { backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: COLORS.ink, fontSize: 19, fontWeight: '900' }, profileCopy: { flex: 1, minWidth: 0 }, profileLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' }, profileEmail: { color: COLORS.ink, fontSize: 13, fontWeight: '800', marginTop: 3, flexShrink: 1 }, planBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F1F2F5' }, planBadgePlus: { backgroundColor: COLORS.greenSoft }, planBadgeText: { color: COLORS.muted, fontSize: 10, fontWeight: '900' }, planBadgeTextPlus: { color: COLORS.greenDark }, cancelledNote: { color: COLORS.red, backgroundColor: COLORS.redSoft, padding: 11, borderRadius: 13, fontSize: 12, lineHeight: 17 },
  trialBanner: { marginHorizontal: 12, marginTop: 8, borderRadius: 17, backgroundColor: COLORS.yellow, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, trialBang: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' }, trialBangText: { color: '#fff', fontWeight: '900' }, trialBannerCopy: { flex: 1 }, trialBannerTitle: { color: COLORS.ink, fontWeight: '900', fontSize: 12 }, trialBannerText: { color: COLORS.muted, fontSize: 10, marginTop: 2 }, trialBannerLink: { color: COLORS.ink, fontWeight: '900', fontSize: 11 },
  modalLayer: { flex: 1, backgroundColor: 'rgba(16,27,77,.38)', justifyContent: 'flex-end', padding: 12 }, modalCard: { backgroundColor: COLORS.bg, borderRadius: 28, padding: 22, gap: 14, marginBottom: 8 }, modalTitle: { color: COLORS.ink, fontSize: 27, lineHeight: 30, fontWeight: '900', letterSpacing: -0.8 }, paymentCard: { padding: 14, borderRadius: 17, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line }, paymentValue: { color: COLORS.ink, fontSize: 20, fontWeight: '900', marginTop: 3 }, modalLater: { textAlign: 'center', color: COLORS.muted, fontWeight: '800', padding: 8 },
  bottomNav: { flexDirection: 'row', minHeight: 70, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingBottom: Platform.OS === 'android' ? 5 : 2 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIcon: { color: '#8C91A4', fontSize: 21, fontWeight: '700' }, tabLabel: { color: '#8C91A4', fontSize: 9, fontWeight: '800' }, tabActive: { color: COLORS.greenDark }
});
