/**
 * Seed knowledge embeddings vào DB.
 * Chỉ re-embed section nào có content thay đổi (so sánh SHA-256 hash).
 *
 * Chạy: pnpm --filter @xcash/backend seed:knowledge
 */

import * as crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { CASSO_KNOWLEDGE } from '../modules/ai/knowledge/casso';
import { TT133_KNOWLEDGE } from '../modules/ai/knowledge/tt133';
import { XCASH_FEATURES_KNOWLEDGE } from '../modules/ai/knowledge/xcash-features';

const ALL_SECTIONS = [...CASSO_KNOWLEDGE, ...TT133_KNOWLEDGE, ...XCASH_FEATURES_KNOWLEDGE];

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY chưa cấu hình trong .env');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

  console.log(`📚 Tổng ${ALL_SECTIONS.length} sections cần kiểm tra...\n`);

  let embedded = 0;
  let skipped = 0;

  for (const section of ALL_SECTIONS) {
    const contentHash = sha256(section.title + '\n' + section.content);

    const existing = await prisma.knowledgeEmbedding.findUnique({
      where: { sectionId: section.id },
      select: { contentHash: true },
    });

    if (existing?.contentHash === contentHash) {
      console.log(`  ⏭  ${section.id} — không đổi, bỏ qua`);
      skipped++;
      continue;
    }

    console.log(`  ⚡ ${section.id} — embedding...`);
    const input = `${section.title}\n\n${section.content}`;
    const res = await openai.embeddings.create({ model, input });
    const vector = res.data[0]?.embedding;

    if (!vector) {
      console.warn(`  ⚠️  ${section.id} — OpenAI không trả về embedding, bỏ qua`);
      continue;
    }

    // Upsert với raw SQL vì Prisma chưa hỗ trợ vector type native
    await prisma.$executeRaw`
      INSERT INTO knowledge_embeddings (id, section_id, title, content, content_hash, embedding, updated_at)
      VALUES (
        gen_random_uuid(),
        ${section.id},
        ${section.title},
        ${section.content},
        ${contentHash},
        ${`[${vector.join(',')}]`}::vector,
        NOW()
      )
      ON CONFLICT (section_id) DO UPDATE SET
        title        = EXCLUDED.title,
        content      = EXCLUDED.content,
        content_hash = EXCLUDED.content_hash,
        embedding    = EXCLUDED.embedding,
        updated_at   = NOW()
    `;

    console.log(`  ✅ ${section.id} — done`);
    embedded++;
  }

  await prisma.$disconnect();

  console.log(`\n✨ Xong: ${embedded} embedded, ${skipped} bỏ qua (không đổi)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
