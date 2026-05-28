/**
 * API 集成测试
 * 用法: npm run test:api
 * 前置条件: 后端运行在 localhost:3000 (或设置 API_BASE 环境变量)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

interface ParseResponse {
  code: number;
  data?: {
    platform: string;
    title: string;
    author: string;
    cover: string;
    video_url: string;
  };
  msg?: string;
}

interface TranscribeResponse {
  code: number;
  task_id?: string;
  status?: string;
  stage?: string;
  data?: { text: string };
  msg?: string;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function post(path: string, body: unknown) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, data: await resp.json() };
}

async function get(path: string) {
  const resp = await fetch(`${API_BASE}${path}`);
  return { status: resp.status, data: await resp.json() };
}

async function run() {
  console.log(`\nAPI 集成测试 — ${API_BASE}\n`);

  // Health
  console.log('Health Check');
  {
    const { status, data } = await get('/api/health');
    assert(status === 200, '返回 200');
    assert(data.status === 'ok', 'status 为 ok');
  }

  // Parse: empty URL
  console.log('\nParse — 空 URL');
  {
    const { data } = await post('/api/parse', { url: '' });
    assert(data.code === 400, 'code 应为 400');
    assert(typeof data.msg === 'string' && data.msg.length > 0, '有错误消息');
  }

  // Parse: invalid URL
  console.log('\nParse — 无效 URL');
  {
    const { data } = await post('/api/parse', { url: 'not-a-valid-url' });
    assert(data.code === 400, 'code 应为 400');
  }

  // Parse: unsupported platform
  console.log('\nParse — 不支持的平台');
  {
    const { data } = await post('/api/parse', { url: 'https://youtube.com/watch?v=abc123' });
    assert(data.code === 400, 'code 应为 400');
    assert(data.msg?.includes('暂不支持'), '提示不支持该平台');
  }

  // Transcribe: submit task
  console.log('\nTranscribe — 提交任务');
  let taskId = '';
  {
    const { status, data } = await post('/api/transcribe', {
      video_url: 'https://example.com/test.mp4',
    });
    assert(status === 200, '返回 200');
    assert(data.code === 202, 'code 应为 202');
    assert(typeof data.task_id === 'string' && data.task_id.length > 0, '返回 task_id');
    assert(data.status === 'pending', '初始状态为 pending');
    taskId = data.task_id!;
  }

  // Transcribe: query task
  console.log('\nTranscribe — 查询任务');
  {
    const { status, data } = await get(`/api/transcribe/${taskId}`);
    assert(status === 200, '返回 200');
    assert(data.code === 200, 'code 应为 200');
    assert(['pending', 'processing'].includes(data.status || ''), '状态为 pending 或 processing');
  }

  // Transcribe: nonexistent task
  console.log('\nTranscribe — 不存在的任务');
  {
    const { status, data } = await get('/api/transcribe/nonexistent-id');
    assert(status === 404, '返回 404');
    assert(data.code === 404, 'code 应为 404');
  }

  // Transcribe: missing video_url
  console.log('\nTranscribe — 缺少 video_url');
  {
    const { status } = await post('/api/transcribe', {});
    assert(status === 422, '返回 422 (validation error)');
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`通过: ${passed}  失败: ${failed}`);
  console.log(`${'='.repeat(40)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('测试运行失败:', err.message);
  process.exit(1);
});
