import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IMP_LABELS } from '@shared/labels.js';
import { Checkbox } from './checkbox';
import { DateField, TimeField } from './datetime-field';
import { Field, FieldError, FieldRow, inputBox } from './field';
import { ProgressField } from './progress-field';
import type { Category, Todo, TodoInput } from '@/lib/api';
import { categoryColors, colors, fontFamily, importanceChip, importanceColors, radius, TAP, WEIGHT_SEMI } from '@/constants/tokens';

/**
 * 할 일 추가·수정 폼. 웹 `TodoForm.jsx`와 같은 규칙을 지킨다.
 *
 * - `categories`가 **배열이면 "이것이 전부", null이면 "아직 모른다"**이다.
 *   모를 때는 `category_id`를 **요청에 아예 넣지 않는다** — 서버는 그 필드가 없으면
 *   있던 성격을 그대로 두므로(app.js의 `category_id !== undefined`), 성격 목록을
 *   못 받아온 화면에서 할 일을 고쳐도 붙어 있던 성격이 살아남는다.
 * - 목록에 없는 성격을 가리키고 있으면(방금 지웠다면) 고르지 않은 것으로 본다.
 *   저장해 둔 값이 아니라 **그릴 때** 따지므로 성격 목록이 늦게 도착해도 맞다.
 * - 종료가 시작보다 빠르면 저장을 막는다 — 타임라인에서 길이가 음수가 된다.
 * - 진행률은 **수정할 때만** 보낸다. 새로 만들 때 0을 보내면 "아직 안 정함(null)"과
 *   "0%"를 구분할 수 없다.
 */
export function TodoForm({ initialValues, categories, onSubmit, onCancel }: {
  /** 수정할 항목. null이면 새로 만드는 것이다. */
  initialValues: Todo | null;
  categories: Category[] | null;
  onSubmit: (data: TodoInput) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [importance, setImportance] = useState<1 | 2 | 3>(1);
  // ''가 "성격 없음". 없는 성격을 가리킬 수도 있어 문자열로 들고 있는다.
  const [categoryId, setCategoryId] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [performDate, setPerformDate] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    const v = initialValues;
    setText(v?.text ?? '');
    setImportance((v?.importance ?? 1) as 1 | 2 | 3);
    setCategoryId(String(v?.category_id ?? ''));
    setDeadline(v?.deadline ?? null);
    setPerformDate(v?.perform_date ?? null);
    setNeedsReview(!!v?.needs_review);
    setStartTime(v?.start_time ?? null);
    setEndTime(v?.end_time ?? null);
    setProgress(v?.progress ?? 0);
    setTimeError(null);
  }, [initialValues]);

  const isEditing = !!initialValues;
  const knowsCategories = Array.isArray(categories);
  const categoryList = categories ?? [];
  const selectedCategoryId =
    categoryList.some(c => String(c.id) === categoryId) ? categoryId : '';

  function submit() {
    if (!text.trim()) return;

    // "09:30" 같은 형식이라 문자열 비교로 충분하다.
    if (startTime && endTime && endTime <= startTime) {
      setTimeError('종료 시간은 시작 시간보다 뒤여야 합니다.');
      return;
    }
    setTimeError(null);

    onSubmit({
      text: text.trim(),
      importance,
      ...(knowsCategories ? { category_id: selectedCategoryId || null } : {}),
      deadline: deadline || null,
      perform_date: performDate || null,
      needs_review: needsReview,
      start_time: startTime || null,
      end_time: endTime || null,
      ...(isEditing ? { progress } : {}),
    });
  }

  return (
    <>
      <Text style={styles.title}>{isEditing ? '할 일 수정' : '할 일 추가'}</Text>

      <Field label="내용">
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="무엇을 공부할 건가요?"
          placeholderTextColor={colors.muted}
          accessibilityLabel="내용"
          autoFocus={!isEditing}
          returnKeyType="done"
        />
      </Field>

      <Field label="중요도">
        <View style={styles.impRow}>
          {([1, 2, 3] as const).map(v => {
            const on = importance === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.impBtn,
                  on && { backgroundColor: importanceChip[v].bg, borderColor: importanceColors[v] },
                ]}
                onPress={() => setImportance(v)}
              >
                <Text style={[styles.impText, on && { color: importanceChip[v].fg }]}>
                  {IMP_LABELS[v]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* 성격 — 웹은 <select>다. 사용자가 여럿 만들 수 있어 버튼으로 깔면 시트를 통째로
          먹기 때문인데, 앱에서는 **가로로 넘기는 줄**로 두면 세로 자리를 먹지 않는다.
          고른 것은 색이 아니라 **고리**로 표시한다 — 색만으로 구분되면 못 알아보는 사람이 있다. */}
      {categoryList.length > 0 && (
        <Field label="성격" optional="선택">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            <CatChip
              label="성격 없음"
              selected={!selectedCategoryId}
              onPress={() => setCategoryId('')}
            />
            {categoryList.map(c => (
              <CatChip
                key={c.id}
                label={c.name}
                slot={c.color}
                selected={selectedCategoryId === String(c.id)}
                onPress={() => setCategoryId(String(c.id))}
              />
            ))}
          </ScrollView>
        </Field>
      )}

      {/* 고를 것이 "성격 없음" 하나뿐인 칸은 고장으로 읽히므로 안내로 바꾼다.
          목록을 아직 모를 때는 이 말도 하지 않는다 — 없는지 못 받아온 것인지 모르면서
          "만들지 않았다"고 하면 거짓말이 된다. */}
      {knowsCategories && categoryList.length === 0 && (
        <Text style={styles.hint}>
          성격을 아직 만들지 않았습니다. 웹의 계정 메뉴 → “성격 관리”에서 추가할 수 있습니다.
        </Text>
      )}

      <FieldRow>
        <DateField label="마감일" optional="언제까지" value={deadline} onChange={setDeadline} />
        <DateField label="수행날짜" optional="언제 할지" value={performDate} onChange={setPerformDate} />
      </FieldRow>

      <FieldRow>
        <TimeField
          label="시작 시간"
          optional="선택"
          value={startTime}
          onChange={v => { setStartTime(v); setTimeError(null); }}
        />
        <TimeField
          label="종료 시간"
          optional="선택"
          value={endTime}
          onChange={v => { setEndTime(v); setTimeError(null); }}
        />
      </FieldRow>

      {timeError && <FieldError>{timeError}</FieldError>}

      <Pressable
        style={styles.reviewToggle}
        accessibilityRole="button"
        onPress={() => setNeedsReview(o => !o)}
      >
        <Checkbox checked={needsReview} label="복습 필요" onChange={setNeedsReview} />
        <Text style={styles.reviewLabel}>
          복습 필요
          <Text style={styles.reviewHint}>
            {'\n'}완료 시 망각곡선 일정 자동 생성 (1·3·7·16·30일)
          </Text>
        </Text>
      </Pressable>

      {isEditing && <ProgressField value={progress} onChange={setProgress} />}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
          onPress={onCancel}
        >
          <Text style={styles.btnGhostText}>취소</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={!text.trim()}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            !text.trim() && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={submit}
        >
          <Text style={styles.btnPrimaryText}>{isEditing ? '수정 완료' : '추가하기'}</Text>
        </Pressable>
      </View>
    </>
  );
}

function CatChip({ label, slot, selected, onPress }: {
  label: string;
  /** 성격의 색 칸(1~8). 없으면 "성격 없음" 칩이다. */
  slot?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const color = slot ? categoryColors[slot as keyof typeof categoryColors] : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.catChip,
        color ? { backgroundColor: color.bg } : { borderWidth: 1, borderColor: colors.line },
        selected && styles.catChipOn,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.catText, { color: color ? color.fg : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fontFamily.display, fontSize: 16.3, color: colors.text },

  input: inputBox,
  hint: { fontFamily: fontFamily.body, fontSize: 13, color: colors.muted, lineHeight: 19 },

  impRow: { flexDirection: 'row', gap: 5 },
  impBtn: {
    flex: 1,
    minHeight: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  impText: { fontFamily: fontFamily.body, fontSize: 14, fontWeight: WEIGHT_SEMI, color: colors.muted },

  catRow: { gap: 6, paddingRight: 4 },
  catChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 99,
  },
  // 고리로 고른 것을 표시한다. 색만으로 구분하지 않는다.
  catChipOn: { borderWidth: 2, borderColor: colors.text },
  catText: { fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },

  reviewToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: TAP,
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  reviewLabel: { fontFamily: fontFamily.body, flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  reviewHint: { fontFamily: fontFamily.body, fontSize: 12.5, color: colors.muted, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    minHeight: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.7 },
  btnGhost: { borderWidth: 1, borderColor: colors.line },
  btnGhostText: { fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600', color: colors.muted },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600', color: colors.onAccent },
  btnDisabled: { opacity: 0.45 },
});
