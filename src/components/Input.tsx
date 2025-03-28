import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  variant?: 'outlined' | 'filled' | 'underlined';
  animated?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      inputStyle,
      labelStyle,
      errorStyle,
      variant = 'outlined',
      animated = true,
      value,
      onFocus,
      onBlur,
      secureTextEntry,
      ...rest
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isSecureVisible, setIsSecureVisible] = useState(!secureTextEntry);
    
    // Animation for the floating label
    const labelAnimation = useState(new Animated.Value(value ? 1 : 0))[0];
    
    // Handle focus events
    const handleFocus = (e: any) => {
      setIsFocused(true);
      if (animated) {
        Animated.timing(labelAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
      onFocus && onFocus(e);
    };
    
    // Handle blur events
    const handleBlur = (e: any) => {
      setIsFocused(false);
      if (animated && !value) {
        Animated.timing(labelAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
      onBlur && onBlur(e);
    };
    
    // Get container style based on variant
    const getContainerStyle = () => {
      switch (variant) {
        case 'filled':
          return [
            styles.container,
            styles.filledContainer,
            isFocused && styles.focusedFilledContainer,
            error && styles.errorContainer,
          ];
        case 'underlined':
          return [
            styles.container,
            styles.underlinedContainer,
            isFocused && styles.focusedUnderlinedContainer,
            error && styles.errorContainer,
          ];
        default:
          return [
            styles.container,
            styles.outlinedContainer,
            isFocused && styles.focusedOutlinedContainer,
            error && styles.errorContainer,
          ];
      }
    };
    
    // Get input style based on variant
    const getInputStyle = () => {
      const baseStyle = [
        styles.input,
        leftIcon && styles.inputWithLeftIcon,
        rightIcon && styles.inputWithRightIcon,
      ];
      
      switch (variant) {
        case 'filled':
          return [...baseStyle, styles.filledInput];
        case 'underlined':
          return [...baseStyle, styles.underlinedInput];
        default:
          return [...baseStyle, styles.outlinedInput];
      }
    };
    
    // Calculate label position and size for animated labels
    const labelPosition = {
      top: labelAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [variant === 'filled' ? 16 : 14, -8],
      }),
      left: labelAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [leftIcon ? 36 : 12, 8],
      }),
      fontSize: labelAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 12],
      }),
      color: labelAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [
          error ? theme.colors.error : theme.colors.textSecondary,
          error ? theme.colors.error : isFocused ? theme.colors.primary : theme.colors.textSecondary,
        ],
      }),
      backgroundColor: variant === 'outlined' && animated 
        ? labelAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['transparent', theme.colors.background],
          })
        : 'transparent',
      paddingHorizontal: animated
        ? labelAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 4],
          })
        : 0,
    };
    
    // Show a static label if not animated
    const renderStaticLabel = () => {
      if (label && !animated) {
        return (
          <Text
            style={[
              styles.staticLabel,
              {
                color: error
                  ? theme.colors.error
                  : isFocused
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        );
      }
      return null;
    };
    
    // Show an animated label if animated
    const renderAnimatedLabel = () => {
      if (label && animated) {
        return (
          <Animated.Text
            style={[
              styles.label,
              {
                top: labelPosition.top,
                left: labelPosition.left,
                fontSize: labelPosition.fontSize,
                color: labelPosition.color,
                backgroundColor: labelPosition.backgroundColor,
                paddingHorizontal: labelPosition.paddingHorizontal,
              },
              labelStyle,
            ]}
          >
            {label}
          </Animated.Text>
        );
      }
      return null;
    };
    
    // Show error message if any
    const renderError = () => {
      if (error) {
        return (
          <Text style={[styles.errorText, errorStyle]}>
            {error}
          </Text>
        );
      }
      return null;
    };
    
    // Toggle password visibility
    const toggleSecureEntry = () => {
      setIsSecureVisible(!isSecureVisible);
    };
    
    // Calculate actual secure text entry value
    const actualSecureTextEntry = secureTextEntry ? !isSecureVisible : false;
    
    // Show password visibility toggle for secure inputs
    const renderSecureToggle = () => {
      if (secureTextEntry) {
        return (
          <TouchableOpacity 
            style={styles.rightIcon} 
            onPress={toggleSecureEntry}
          >
            <Ionicons 
              name={isSecureVisible ? 'eye-off' : 'eye'} 
              size={20} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        );
      }
      return null;
    };
    
    return (
      <View style={[containerStyle]}>
        <View style={getContainerStyle()}>
          {renderStaticLabel()}
          
          {leftIcon && (
            <View style={styles.leftIcon}>
              <Ionicons
                name={leftIcon as any}
                size={20}
                color={
                  isFocused
                    ? theme.colors.primary
                    : error
                    ? theme.colors.error
                    : theme.colors.textSecondary
                }
              />
            </View>
          )}
          
          <TextInput
            ref={ref}
            style={[getInputStyle(), inputStyle]}
            placeholderTextColor={theme.colors.placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            value={value}
            secureTextEntry={actualSecureTextEntry}
            {...rest}
          />
          
          {renderAnimatedLabel()}
          
          {renderSecureToggle()}
          
          {rightIcon && !secureTextEntry && (
            <TouchableOpacity
              style={styles.rightIcon}
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
            >
              <Ionicons
                name={rightIcon as any}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
        
        {renderError()}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    marginVertical: theme.spacing.sm,
  },
  outlinedContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    minHeight: 56,
  },
  filledContainer: {
    borderWidth: 0,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfacePrimary,
    minHeight: 56,
  },
  underlinedContainer: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 48,
  },
  focusedOutlinedContainer: {
    borderColor: theme.colors.primary,
  },
  focusedFilledContainer: {
    borderBottomColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}08`,
  },
  focusedUnderlinedContainer: {
    borderBottomColor: theme.colors.primary,
    borderBottomWidth: 2,
  },
  errorContainer: {
    borderColor: theme.colors.error,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
  },
  outlinedInput: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  filledInput: {
    paddingTop: 24,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  underlinedInput: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 0,
  },
  inputWithLeftIcon: {
    paddingLeft: 40,
  },
  inputWithRightIcon: {
    paddingRight: 40,
  },
  leftIcon: {
    position: 'absolute',
    left: theme.spacing.md,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcon: {
    position: 'absolute',
    right: theme.spacing.md,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    position: 'absolute',
    fontWeight: '500',
  },
  staticLabel: {
    position: 'absolute',
    top: -20,
    left: 0,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
  },
});

export default Input; 