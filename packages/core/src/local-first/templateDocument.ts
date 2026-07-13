import * as Y from 'yjs'
import type { EntityId, IsoDateTimeString, UserId } from './documentModel'

export const TEMPLATE_DOCUMENT_SCHEMA_VERSION = 1
export const TEMPLATE_DOCUMENT_TYPE = 'template'

const TEMPLATE_DOCUMENT_MAP_NAME = 'templateDocumentV1'
const TEMPLATE_DOCUMENT_VALUE_KEY = 'document'

export type TemplateDocumentSchemaVersion = typeof TEMPLATE_DOCUMENT_SCHEMA_VERSION
export type TemplateVisibility = 'private' | 'shared' | 'public'
export type TemplateShareRole = 'viewer' | 'editor'
export type TemplateTombstoneEntityType = 'template' | 'templateItem' | 'templateShare'

export interface TemplateDocumentV1 {
  schemaVersion: TemplateDocumentSchemaVersion
  template: TemplateRootNode
  items: Record<EntityId, TemplateItemNode>
  shares: Record<EntityId, TemplateShareNode>
  tombstones: Record<EntityId, TemplateTombstoneNode>
  meta: TemplateDocumentMeta
}

export interface TemplateRootNode {
  id: EntityId
  ownerId: UserId | null
  title: string
  visibility: TemplateVisibility
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface TemplateItemNode {
  id: EntityId
  templateId: EntityId
  name: string
  categoryName: string
  isPrivate: boolean
  sortOrder: number
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
}

export interface TemplateShareNode {
  id: EntityId
  templateId: EntityId
  sharedWithUserId: UserId
  role: TemplateShareRole
  createdBy: UserId | null
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString | null
}

export interface TemplateTombstoneNode {
  id: EntityId
  entityType: TemplateTombstoneEntityType
  entityId: EntityId
  deletedBy: UserId
  deletedAt: IsoDateTimeString
  reason?: string
}

export interface TemplateDocumentMeta {
  createdFromLegacyAt?: IsoDateTimeString
  lastLegacyExportAt?: IsoDateTimeString
  lastBackupAt?: IsoDateTimeString
}

export interface CreateTemplateDocumentInput {
  id: EntityId
  ownerId: UserId | null
  title: string
  visibility?: TemplateVisibility
  createdAt: IsoDateTimeString
  updatedAt?: IsoDateTimeString
  createdFromLegacyAt?: IsoDateTimeString
}

export function createEmptyTemplateDocumentV1(
  input: CreateTemplateDocumentInput,
): TemplateDocumentV1 {
  return {
    schemaVersion: TEMPLATE_DOCUMENT_SCHEMA_VERSION,
    template: {
      id: input.id,
      ownerId: input.ownerId,
      title: input.title,
      visibility: input.visibility ?? (input.ownerId ? 'private' : 'public'),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt ?? input.createdAt,
    },
    items: {},
    shares: {},
    tombstones: {},
    meta: {
      createdFromLegacyAt: input.createdFromLegacyAt,
    },
  }
}

export function createYjsTemplateDocument(initialDocument?: TemplateDocumentV1): Y.Doc {
  const doc = new Y.Doc()
  if (initialDocument) writeTemplateDocumentToYjs(doc, initialDocument)
  return doc
}

export function readTemplateDocumentFromYjs(doc: Y.Doc): TemplateDocumentV1 | null {
  const value = getTemplateDocumentMap(doc).get(TEMPLATE_DOCUMENT_VALUE_KEY)
  if (!value) return null
  return cloneTemplateDocument(value as TemplateDocumentV1)
}

export function writeTemplateDocumentToYjs(doc: Y.Doc, templateDocument: TemplateDocumentV1): void {
  getTemplateDocumentMap(doc).set(TEMPLATE_DOCUMENT_VALUE_KEY, cloneTemplateDocument(templateDocument))
}

export function mutateTemplateDocumentInYjs(
  doc: Y.Doc,
  mutate: (templateDocument: TemplateDocumentV1) => void,
): TemplateDocumentV1 {
  const templateDocument = readTemplateDocumentFromYjs(doc)
  if (!templateDocument) throw new Error('Template document is not initialized.')

  mutate(templateDocument)
  writeTemplateDocumentToYjs(doc, templateDocument)
  return templateDocument
}

export function encodeTemplateDocumentUpdate(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

export function applyTemplateDocumentUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update)
}

function getTemplateDocumentMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(TEMPLATE_DOCUMENT_MAP_NAME)
}

function cloneTemplateDocument(templateDocument: TemplateDocumentV1): TemplateDocumentV1 {
  return JSON.parse(JSON.stringify(templateDocument)) as TemplateDocumentV1
}
