import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-8">
      <Text className="text-4xl font-bold text-primary">Maker WMS</Text>
      <Text className="text-base text-gray-500">Gestión de almacenes</Text>
      <Text className="text-sm text-gray-400">Fase 0 — Mobile configurado ✓</Text>
    </View>
  );
}
