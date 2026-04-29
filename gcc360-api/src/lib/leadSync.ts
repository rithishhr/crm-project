export type LeadLike = {
  company: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  industry?: string | null
  requirements?: string | null
  tags?: string | null
  title?: string | null
  assignedToId?: string | null
  companyId: string
}

export type ClientLike = {
  id: string
  name: string
  contactPerson?: string | null
  contactTitle?: string | null
  email?: string | null
  phone?: string | null
  industry?: string | null
  country?: string | null
  notes?: string | null
  tags?: string | null
  companyId: string
}

type DbLike = {
  client: {
    findMany: (args: any) => Promise<any[]>
    create: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
  }
  contact: {
    findMany: (args: any) => Promise<any[]>
    create: (args: any) => Promise<any>
    update: (args: any) => Promise<any>
  }
}

function normalizeLookup(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '—'
}

function looksSimilar(a?: string | null, b?: string | null) {
  const left = normalizeLookup(a)
  const right = normalizeLookup(b)
  if (!left || !right) return false
  if (left === right) return true
  return left.length > 3 && right.length > 3 && (left.includes(right) || right.includes(left))
}

function splitContactName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Contact' }
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Contact' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export async function syncLeadToClientAndContact(db: DbLike, lead: LeadLike) {
  const leadEmail = normalizeLookup(lead.email)
  const leadPhone = normalizeLookup(lead.phone)

  const clients = await db.client.findMany({
    where: { companyId: lead.companyId },
    select: { id: true, name: true, email: true, phone: true, contactPerson: true, contactTitle: true, industry: true, country: true, notes: true, tags: true },
  })

  let client = clients.find((candidate: any) => {
    const sameCompany = looksSimilar(candidate.name, lead.company)
    const sameEmail = !!leadEmail && normalizeLookup(candidate.email) === leadEmail
    const samePhone = !!leadPhone && normalizeLookup(candidate.phone) === leadPhone
    return sameCompany || sameEmail || samePhone
  })

  const createdClient = !client
  if (!client) {
    client = await db.client.create({
      data: {
        name: lead.company,
        industry: lead.industry || '',
        country: lead.country || 'UAE',
        contactPerson: lead.contactName || '',
        contactTitle: lead.title || '',
        email: lead.email || '',
        phone: lead.phone || '',
        notes: lead.requirements || '',
        tags: lead.tags || '',
        companyId: lead.companyId,
      }
    })
  } else {
    const clientPatch: Record<string, unknown> = {}
    if (isBlank(client.industry) && !isBlank(lead.industry)) clientPatch.industry = lead.industry
    if (isBlank(client.country) && !isBlank(lead.country)) clientPatch.country = lead.country
    if (isBlank(client.contactPerson) && !isBlank(lead.contactName)) clientPatch.contactPerson = lead.contactName
    if (isBlank(client.contactTitle) && !isBlank(lead.title)) clientPatch.contactTitle = lead.title
    if (isBlank(client.email) && !isBlank(lead.email)) clientPatch.email = lead.email
    if (isBlank(client.phone) && !isBlank(lead.phone)) clientPatch.phone = lead.phone
    if (isBlank(client.notes) && !isBlank(lead.requirements)) clientPatch.notes = lead.requirements
    if (isBlank(client.tags) && !isBlank(lead.tags)) clientPatch.tags = lead.tags

    if (Object.keys(clientPatch).length > 0) {
      client = await db.client.update({
        where: { id: client.id },
        data: clientPatch,
      })
    }
  }

  const contacts = await db.contact.findMany({
    where: { companyId: lead.companyId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, company: true, notes: true, tags: true, clientId: true, ownerId: true },
  })

  const existingContact = contacts.find((candidate: any) => {
    const sameEmail = !!leadEmail && normalizeLookup(candidate.email) === leadEmail
    const samePhone = !!leadPhone && (
      normalizeLookup(candidate.phone) === leadPhone ||
      normalizeLookup(candidate.mobile) === leadPhone
    )
    const sameName = looksSimilar(`${candidate.firstName} ${candidate.lastName}`, lead.contactName)
    const sameCompany = looksSimilar(candidate.company, lead.company)
    return sameEmail || samePhone || sameName || sameCompany
  })

  const { firstName, lastName } = splitContactName(lead.contactName || lead.company)
  const contactData = {
    firstName,
    lastName,
    clientId: client.id,
    jobTitle: '',
    department: '',
    email: lead.email || '',
    phone: lead.phone || '',
    mobile: '',
    ownerId: lead.assignedToId || null,
    status: 'ACTIVE',
    company: lead.company,
    notes: lead.requirements || '',
    tags: lead.tags || '',
    companyId: lead.companyId,
  }

  const createdContact = !existingContact
  if (existingContact) {
    const contactPatch: Record<string, unknown> = {
      clientId: client.id,
      company: lead.company,
    }
    if (isBlank(existingContact.firstName) && !isBlank(contactData.firstName)) contactPatch.firstName = contactData.firstName
    if (isBlank(existingContact.lastName) && !isBlank(contactData.lastName)) contactPatch.lastName = contactData.lastName
    if (isBlank(existingContact.email) && !isBlank(contactData.email)) contactPatch.email = contactData.email
    if (isBlank(existingContact.phone) && !isBlank(contactData.phone)) contactPatch.phone = contactData.phone
    if (isBlank(existingContact.mobile) && !isBlank(contactData.mobile)) contactPatch.mobile = contactData.mobile
    if (isBlank(existingContact.notes) && !isBlank(contactData.notes)) contactPatch.notes = contactData.notes
    if (isBlank(existingContact.tags) && !isBlank(contactData.tags)) contactPatch.tags = contactData.tags
    if (isBlank(existingContact.ownerId) && !isBlank(contactData.ownerId)) contactPatch.ownerId = contactData.ownerId

    await db.contact.update({
      where: { id: existingContact.id },
      data: contactPatch,
    })
  } else {
    await db.contact.create({ data: contactData })
  }

  return {
    client,
    contact: existingContact || contactData,
    createdClient,
    createdContact,
  }
}

export async function syncClientToContact(db: DbLike, client: ClientLike) {
  const clientEmail = normalizeLookup(client.email)
  const clientPhone = normalizeLookup(client.phone)

  const contacts = await db.contact.findMany({
    where: { companyId: client.companyId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, company: true, notes: true, tags: true, clientId: true, ownerId: true },
  })

  const contactName = client.contactPerson || client.name
  const existingContact = contacts.find((candidate: any) => {
    const sameEmail = !!clientEmail && normalizeLookup(candidate.email) === clientEmail
    const samePhone = !!clientPhone && (
      normalizeLookup(candidate.phone) === clientPhone ||
      normalizeLookup(candidate.mobile) === clientPhone
    )
    const sameCompany = looksSimilar(candidate.company, client.name)
    const sameContactPerson = looksSimilar(`${candidate.firstName} ${candidate.lastName}`, contactName)
    return sameEmail || samePhone || sameCompany || sameContactPerson
  })

  const { firstName, lastName } = splitContactName(contactName)
  const contactData = {
    firstName,
    lastName,
    clientId: client.id,
    jobTitle: client.contactTitle || '',
    department: '',
    email: client.email || `client-${client.id}@placeholder.local`,
    phone: client.phone || '',
    mobile: '',
    ownerId: null,
    status: 'ACTIVE',
    company: client.name,
    notes: client.notes || '',
    tags: client.tags || '',
    companyId: client.companyId,
  }

  const createdContact = !existingContact
  if (existingContact) {
    const contactPatch: Record<string, unknown> = {
      clientId: client.id,
      company: client.name,
    }
    if (isBlank(existingContact.firstName) && !isBlank(contactData.firstName)) contactPatch.firstName = contactData.firstName
    if (isBlank(existingContact.lastName) && !isBlank(contactData.lastName)) contactPatch.lastName = contactData.lastName
    if (isBlank(existingContact.email) && !isBlank(contactData.email)) contactPatch.email = contactData.email
    if (isBlank(existingContact.phone) && !isBlank(contactData.phone)) contactPatch.phone = contactData.phone
    if (isBlank(existingContact.mobile) && !isBlank(contactData.mobile)) contactPatch.mobile = contactData.mobile
    if (isBlank(existingContact.notes) && !isBlank(contactData.notes)) contactPatch.notes = contactData.notes
    if (isBlank(existingContact.tags) && !isBlank(contactData.tags)) contactPatch.tags = contactData.tags

    await db.contact.update({
      where: { id: existingContact.id },
      data: contactPatch,
    })
  } else {
    await db.contact.create({ data: contactData })
  }

  return {
    contact: existingContact || contactData,
    createdContact,
  }
}