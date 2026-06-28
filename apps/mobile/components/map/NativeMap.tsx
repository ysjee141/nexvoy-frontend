import type { ComponentType, ReactNode } from 'react'

export type NativeMapViewProps = {
  style?: unknown
  initialRegion?: {
    latitude: number
    longitude: number
    latitudeDelta: number
    longitudeDelta: number
  }
  children?: ReactNode
}

export type NativeMarkerProps = {
  coordinate: { latitude: number; longitude: number }
  title?: string
  description?: string
}

let NativeMapView: ComponentType<NativeMapViewProps> | null = null
let NativeMarker: ComponentType<NativeMarkerProps> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('react-native-maps') as {
    default: ComponentType<NativeMapViewProps>
    Marker: ComponentType<NativeMarkerProps>
  }
  NativeMapView = maps.default
  NativeMarker = maps.Marker
} catch {
  // Expo Go or unsupported native runtime: callers render a fallback UI.
}

export { NativeMapView, NativeMarker }
