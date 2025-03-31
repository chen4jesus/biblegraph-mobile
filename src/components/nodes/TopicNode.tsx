// src/components/nodes/TopicNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { View, Text, StyleSheet } from 'react-native';

const TopicNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <View style={[styles.node, { backgroundColor: data.color || '#34C759' }]}>
      <Handle type="target" position={Position.Top} />
      <Text style={styles.label}>{data.label}</Text>
      <Handle type="source" position={Position.Bottom} />
    </View>
  );
};

const styles = StyleSheet.create({
  node: {
    padding: 10,
    borderRadius: 5,
    minWidth: 150,
    maxWidth: 250,
  },
  label: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default TopicNode;