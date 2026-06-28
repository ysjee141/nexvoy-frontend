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

export const NativeMapView: ComponentType<NativeMapViewProps> | null = null
export const NativeMarker: ComponentType<NativeMarkerProps> | null = null
