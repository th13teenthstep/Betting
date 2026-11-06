import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';

interface SeasonPickerProps {
  /** Şu an seçili sezon, örn. 2024 */
  selected: number;
  /** Seçilebilecek sezon listesi */
  seasons: number[];
  /** Kullanıcı yeni bir sezon seçtiğinde çağrılır */
  onSelect: (season: number) => void;
}

/**
 * Mevcut sezonu gösteren ve tıklandığında seçim listesi açan
 * açılır menü bileşeni.
 */
export default function SeasonPicker({
  selected,
  seasons,
  onSelect,
}: SeasonPickerProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      {/* Tetikleyici */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        activeOpacity={0.6}
      >
        <Text style={styles.triggerText}>
          Sezon {selected}/{String(selected + 1).slice(-2)}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      {/* Seçim kutusu */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Sezon Seçin</Text>

            <FlatList
              data={seasons}
              keyExtractor={(s) => String(s)}
              renderItem={({ item }) => {
                const isActive = item === selected;
                return (
                  <TouchableOpacity
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => {
                      onSelect(item);
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isActive && styles.optionTextActive,
                      ]}
                    >
                      {item}/{String(item + 1).slice(-2)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            <TouchableOpacity
              style={styles.cancel}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  arrow: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: 260,
    maxHeight: 400,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 14,
  },
  option: {
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: '#E8F0FE',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  optionTextActive: {
    color: '#1A73E8',
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE',
  },
  cancel: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
});