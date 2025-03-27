declare module 'react-native-toast-message' {
  export interface ToastShowParams {
    type?: 'success' | 'error' | 'info';
    position?: 'top' | 'bottom';
    text1?: string;
    text2?: string;
    visibilityTime?: number;
    autoHide?: boolean;
    topOffset?: number;
    bottomOffset?: number;
    props?: Record<string, any>;
    onShow?: () => void;
    onHide?: () => void;
    onPress?: () => void;
  }

  const Toast: {
    show: (params: ToastShowParams) => void;
    hide: () => void;
    setRef: (ref: any) => void;
  };
  
  export default Toast;
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle, TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
  }

  export default class Icon extends Component<IconProps> {
    static getImageSource(
      name: string,
      size?: number,
      color?: string
    ): Promise<any>;
  }
}

declare module 'react-native-svg' {
  import React from 'react';
  import { ViewProps } from 'react-native';

  export interface SvgProps extends ViewProps {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    preserveAspectRatio?: string;
    color?: string;
    title?: string;
  }

  export default class Svg extends React.Component<SvgProps> {}

  export interface CircleProps extends ViewProps {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
  }

  export class Circle extends React.Component<CircleProps> {}

  export interface LineProps extends ViewProps {
    x1?: number | string;
    y1?: number | string;
    x2?: number | string;
    y2?: number | string;
    stroke?: string;
    strokeWidth?: number | string;
  }

  export class Line extends React.Component<LineProps> {}

  export interface TextProps extends ViewProps {
    x?: number | string;
    y?: number | string;
    dx?: number | string;
    dy?: number | string;
    textAnchor?: 'start' | 'middle' | 'end';
    fontWeight?: string | number;
    fontSize?: number | string;
    fontFamily?: string;
    fill?: string;
  }

  export class Text extends React.Component<TextProps> {}

  export interface GProps extends ViewProps {
    // G specific props
    onPress?: () => void;
    onClick?: () => void;
  }

  export class G extends React.Component<GProps> {}
} 