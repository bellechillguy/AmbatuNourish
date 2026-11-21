import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, colors, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './Layout';

/* ------------------------------------------------------------------ */
/* Bottom sheet (F1, G2, J3, J5, O2)                                   */
/* ------------------------------------------------------------------ */

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Sheet modal: scrim 40%, grabber, header (Title 2 + Close 44pt). Fokus terkunci di dalam sheet
 * (Modal), ditutup dengan ×, ketuk scrim, atau tombol kembali sistem.
 */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Tutup" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.s) }]} accessibilityViewIsModal>
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.sheetHeader}>
            <AppText variant="title2" accessibilityRole="header" style={styles.flex}>
              {title}
            </AppText>
            <IconButton icon="close" label="Tutup" size={20} onPress={onClose} />
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog (I5, K5, N4, konfirmasi hapus rencana)                      */
/* ------------------------------------------------------------------ */

export function Dialog({
  visible,
  title,
  message,
  onDismiss,
  children,
}: {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.dialogWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Batal" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <AppText variant="title2" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="subheadline" tone="secondary">
            {message}
          </AppText>
          <View style={styles.dialogActions}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Toast + Urungkan (±5 detik, PROPOSED)                               */
/* ------------------------------------------------------------------ */

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [opacity]);

  const show = useCallback(
    (t: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      AccessibilityInfo.announceForAccessibility(t.message);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, t.durationMs ?? 5000);
    },
    [hide, opacity],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { bottom: insets.bottom + 72, opacity }]}
        >
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Icon name="check" size={20} color={colors.neutralWhite} />
            <AppText variant="subheadlineEmphasized" tone="inverse" style={styles.flex}>
              {toast.message}
            </AppText>
            {toast.actionLabel ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                accessibilityRole="button"
                hitSlop={12}
              >
                <AppText variant="subheadlineEmphasized" tone="inverse" style={styles.underline}>
                  {toast.actionLabel}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: colors.neutralWhite,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: spacing.s,
    paddingHorizontal: spacing.screen,
    alignSelf: 'center',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
  },
  grabberRow: { height: 12, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.labelTertiary },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 44, marginTop: spacing.l },
  sheetScroll: { flexGrow: 0 },
  sheetBody: { gap: spacing.l, paddingTop: spacing.l },
  dialogWrap: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.neutralWhite,
    borderRadius: radius.sheet,
    padding: spacing.xl,
    gap: spacing.m,
  },
  dialogActions: { gap: spacing.s, paddingTop: spacing.s },
  toastWrap: { position: 'absolute', left: spacing.l, right: spacing.l, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: radius.surface,
    backgroundColor: colors.labelPrimary,
  },
  underline: { textDecorationLine: 'underline' },
});
