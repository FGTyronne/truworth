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
const HERO = 'https://truworth-web.onrender.com/assets/hero-products.webp?v=20261009i';
const WEB_PLANS = 'https://truworth-web.onrender.com/plans.html';
const WEB_HOW = 'https://truworth-web.onrender.com/decision-support.html';

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
