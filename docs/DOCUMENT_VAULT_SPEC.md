# Document Vault Feature Specification

**Owner**: Frontend (ChatGPT)
**Priority**: Medium
**Status**: Planning
**Created**: 2025-11-05

---

## Overview

Transform the Documents page from a basic document viewer into a full-featured **secure document vault** where users can store sensitive personal documents like passports, bank statements, utility bills, driving licenses, etc.

## Business Requirements

### Core Purpose
- **Secure storage** for sensitive personal documents
- **Easy access** to important files when needed
- **Organization** by category/folder
- **Quick search** and retrieval
- **Privacy-focused** - all documents encrypted at rest

### User Stories
1. As a user, I want to upload my passport so I have a digital copy when traveling
2. As a user, I want to organize documents by category (Identity, Financial, Property, etc.)
3. As a user, I want to preview PDFs and images without downloading
4. As a user, I want to search for documents by name or category
5. As a user, I want to know my documents are encrypted and secure

---

## Technical Requirements

### File Support
**Must Support:**
- **PDFs**: Bank statements, contracts, invoices
- **Images**: JPEG, PNG, HEIC (passports, licenses, receipts)
- **Max file size**: 10MB per file (configurable)
- **Total storage**: 100MB free tier, more for premium

### Storage Architecture
**Current Infrastructure:**
- `documentService.ts` already exists - review and enhance
- Uses IndexedDB for browser storage
- Consider Supabase Storage for cloud backup (premium feature)

**Requirements:**
- Encrypt files before storing (AES-256)
- Store metadata separately (name, category, upload date, size)
- Support offline access (PWA integration)
- Sync to cloud if user has premium subscription

### Categories/Folders
**Predefined Categories:**
1. **Identity Documents**
   - Passport
   - Driver's License
   - National ID
   - Birth Certificate

2. **Financial Documents**
   - Bank Statements
   - Tax Returns
   - Investment Statements
   - Insurance Policies

3. **Property Documents**
   - Deeds/Title
   - Mortgage Documents
   - Rental Agreements
   - Utility Bills

4. **Other**
   - Custom user-defined folders

### UI/UX Requirements

**Layout:**
```
┌─────────────────────────────────────────┐
│  Documents Vault                    [+] │
├─────────────────────────────────────────┤
│  Search [___________]  Filter [v]       │
├─────────────────────────────────────────┤
│  Categories Sidebar │  Document Grid    │
│  ┌─────────────────┼──────────────────┐ │
│  │ ▣ Identity (3)  │  [📄] [📄] [📄]  │ │
│  │ ▣ Financial (5) │  [📄] [📄] [📄]  │ │
│  │ ▣ Property (2)  │  [📄] [📄] [📄]  │ │
│  │ ▣ Other (1)     │                   │ │
│  └─────────────────┴──────────────────┘ │
└─────────────────────────────────────────┘
```

**Card Design:**
```
┌──────────────┐
│   [📄 Icon]  │  ← File type icon or thumbnail
│  passport.pdf│  ← Filename
│  Identity    │  ← Category
│  2.3 MB      │  ← File size
│  Nov 5, 2025 │  ← Upload date
│  [👁] [⬇] [🗑] │  ← Actions: View, Download, Delete
└──────────────┘
```

**Features:**
- ✅ Drag & drop upload
- ✅ Multi-file upload
- ✅ Preview modal (PDF viewer, image viewer)
- ✅ Grid/List view toggle
- ✅ Sort by: Name, Date, Size, Category
- ✅ Filter by category
- ✅ Search by filename
- ✅ Bulk actions (select multiple, delete)
- ✅ File details modal (metadata, tags, notes)

### Security Requirements

**CRITICAL - Financial App Standards:**
1. **Encryption at rest**: Use Web Crypto API (AES-GCM)
2. **No unencrypted storage**: All files encrypted before IndexedDB
3. **Secure deletion**: Overwrite data before removing
4. **Access control**: User authentication required
5. **Audit trail**: Log all document access/changes
6. **No server upload** in free tier (local storage only)
7. **HTTPS only**: Prevent downgrade attacks

### File Upload Flow
```
User selects file(s)
  ↓
Validate file type & size
  ↓
Generate unique ID
  ↓
Encrypt file content (Web Crypto API)
  ↓
Store encrypted blob in IndexedDB
  ↓
Store metadata in documentService
  ↓
Show success notification
```

### File Retrieval Flow
```
User clicks document
  ↓
Retrieve encrypted blob from IndexedDB
  ↓
Decrypt using Web Crypto API
  ↓
Display in preview modal OR trigger download
```

---

## Implementation Checklist

### Phase 1: Basic File Management (MVP)
- [ ] Update DocumentManager component
- [ ] Implement drag & drop upload
- [ ] File type validation
- [ ] Category selection on upload
- [ ] Grid view with file cards
- [ ] Basic preview (images)
- [ ] Download functionality
- [ ] Delete with confirmation

### Phase 2: Enhanced Features
- [ ] PDF preview integration
- [ ] Search functionality
- [ ] Filter by category
- [ ] Sort options
- [ ] List/Grid view toggle
- [ ] Bulk selection & actions
- [ ] File metadata editing (rename, add notes)

### Phase 3: Security & Premium
- [ ] Implement encryption (Web Crypto API)
- [ ] Supabase Storage integration (premium)
- [ ] Cloud sync (premium)
- [ ] Audit logging
- [ ] Storage quota management
- [ ] Secure sharing (premium feature)

---

## Files to Modify/Create

### Existing Files to Enhance:
1. **src/services/documentService.ts** - Add encryption, better storage
2. **src/components/DocumentManager.tsx** - Complete redesign
3. **src/pages/Documents.tsx** - May need wrapper logic

### New Files to Create:
1. **src/components/documents/DocumentGrid.tsx** - Grid view
2. **src/components/documents/DocumentCard.tsx** - File card component
3. **src/components/documents/DocumentPreview.tsx** - Preview modal
4. **src/components/documents/DocumentUpload.tsx** - Upload component
5. **src/components/documents/CategorySidebar.tsx** - Category navigation
6. **src/hooks/useDocumentVault.ts** - Document management hook
7. **src/utils/documentEncryption.ts** - Encryption helpers

---

## Testing Requirements

**Must Test:**
- [ ] Upload various file types (PDF, JPEG, PNG)
- [ ] Large files (near 10MB limit)
- [ ] Multiple files at once
- [ ] Encryption/decryption works correctly
- [ ] Preview works for all supported types
- [ ] Delete removes encrypted data
- [ ] Category filtering
- [ ] Search functionality
- [ ] Mobile responsiveness
- [ ] Offline functionality (PWA)

---

## Design System Integration

**Colors** (follow new app-wide scheme):
- Background: `bg-[#f0f7ff]`
- Cards: `bg-[#d4dce8]`
- Headers: `bg-[#6b7d98]`
- Hover states: Slightly darker variants

**Components:**
- Use existing modal patterns
- Follow dashboard card design
- Consistent icon sizing (24px standard, 32px for large)
- Proper touch targets (44px minimum)

---

## Security Checklist

**MANDATORY before deployment:**
- [ ] Web Crypto API encryption implemented
- [ ] No plaintext file storage
- [ ] Secure deletion (crypto.randomValues overwrite)
- [ ] HTTPS-only operation
- [ ] No sensitive data in console.log
- [ ] Audit trail for all document operations
- [ ] User authentication verified before access
- [ ] File size limits enforced
- [ ] File type validation (prevent executable uploads)
- [ ] XSS protection on filenames

---

## Premium Features (Future)

**Cloud Sync:**
- Supabase Storage bucket per user
- End-to-end encryption (encrypt before upload)
- Version history
- Multi-device sync

**Advanced Features:**
- OCR text extraction for receipts
- Auto-categorization using AI
- Document expiry reminders (passport, insurance)
- Secure sharing links (time-limited, password-protected)
- Document templates

---

## API/Backend Considerations

**Current**: Fully client-side (IndexedDB)

**Future** (Premium tier):
```
POST /api/documents/upload
GET /api/documents/:id
DELETE /api/documents/:id
PUT /api/documents/:id/metadata
GET /api/documents/quota
```

Supabase RLS policies:
```sql
-- Users can only access their own documents
CREATE POLICY "Users access own documents"
ON storage.objects FOR ALL
USING (auth.uid() = owner);
```

---

## Success Metrics

**User Adoption:**
- % of users who upload at least 1 document
- Average documents per user
- Most popular categories

**Technical:**
- Upload success rate > 99%
- Preview load time < 500ms
- Search response time < 100ms
- Zero security incidents

---

## Notes for Implementation

1. **Start with basic upload/download** - get the core working first
2. **Add encryption immediately** - don't ship without it
3. **Test with real files** - passports, bank statements, etc.
4. **Mobile-first** - many users will upload from phone camera
5. **Accessibility** - screen reader support for file management
6. **Progressive enhancement** - works offline, syncs when online

---

## Questions for Product Owner

1. Should we support document expiry tracking? (e.g., passport expires in 6 months)
2. Should documents be tied to specific accounts/transactions?
3. Do we need document sharing between household members?
4. What's the retention policy? (delete after X years?)
5. Should we support document scanning via camera?

---

**Next Steps**: Review spec with frontend team, create detailed mockups, implement Phase 1 MVP.
