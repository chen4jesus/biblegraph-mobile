import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

const LoadingScreen: React.FC = () => {
  const { t } = useTranslation('common');
  
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>{t('loading')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default LoadingScreen; 