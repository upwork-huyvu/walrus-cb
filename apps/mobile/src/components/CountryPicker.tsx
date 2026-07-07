import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { F, useTheme } from '../theme';
import { COUNTRIES, countryName } from '../config/countries';

type Props = { value: string; onChange: (code: string) => void; disabled?: boolean };

// Dropdown chọn country code (bảng Western Europe DC của Tuya - xem config/countries.ts).
// Row kiểu form của design (label caps + giá trị + ▾) → mở Modal tối có ô tìm kiếm.
export default function CountryPicker({ value, onChange, disabled }: Props) {
  const C = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [query]);

  return (
    <View style={{ marginBottom: 26 }}>
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
        COUNTRY / REGION
      </Text>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          paddingBottom: 10,
        }}
      >
        <Text style={{ fontFamily: F.body, color: C.white, fontSize: 16 }}>
          {countryName(value)} (+{value})
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: C.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderWidth: 1,
              borderColor: C.border,
              maxHeight: '75%',
              paddingTop: 18,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 12 }}>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 19, flex: 1 }}>
                Choose a country
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 22, marginBottom: 8 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or code…"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: C.white,
                  fontFamily: F.body,
                  fontSize: 14,
                }}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.code === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.code);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 22,
                      paddingVertical: 14,
                      borderTopWidth: 1,
                      borderTopColor: C.border,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: F.body,
                        color: selected ? C.ochre : C.white,
                        fontSize: 15,
                        flex: 1,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14 }}>+{item.code}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
