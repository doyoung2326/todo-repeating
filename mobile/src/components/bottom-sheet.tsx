import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';

import { colors, radius } from '@/constants/tokens';

/**
 * 폼을 담는 겹침 창. 웹 `BottomSheet.jsx`와 같은 자리다.
 *
 * 폼을 목록 위에 상시 띄워 두면 자리를 크게 먹어서, + 버튼을 눌렀을 때만 나오게 한다.
 * 바깥(어두운 곳)을 누르면 닫히고, 안드로이드 뒤로가기는 `onRequestClose`가 받는다.
 *
 * 키보드가 올라오면 시트가 가려지므로 iOS에서는 `KeyboardAvoidingView`로 밀어 올린다 —
 * 안드로이드는 시스템이 알아서 창을 밀어 주므로 손대지 않는다.
 */
export function BottomSheet({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="닫기" onPress={onClose} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet} accessibilityViewIsModal accessibilityLabel={label}>
            <View style={styles.grabber} />
            {/* 폼이 길어 화면을 넘치므로 시트 안에서 스크롤한다.
                keyboardShouldPersistTaps 없이 두면 키보드가 떠 있는 동안
                첫 탭이 키보드를 닫는 데 쓰이고 버튼이 안 눌린다. */}
            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,41,31,0.42)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.line,
    marginBottom: 8,
  },
  body: { padding: 16, paddingBottom: 28, gap: 14 },
});
