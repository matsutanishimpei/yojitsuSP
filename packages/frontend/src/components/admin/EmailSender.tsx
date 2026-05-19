import React, { useState, useEffect } from 'react';
import client from '../../lib/hc';
import { Send, AlertTriangle, CheckCircle, Mail, Play, Loader } from 'lucide-react';
import { ApplicationCard } from '@my-app/shared';

interface StudentStat {
  student_id: string;
  student_name: string;
  parent_email: string | null;
  is_completed: number;
}

interface EmailSenderProps {
  adminId: string;
  studentsList: StudentStat[];
}

interface BulkSendItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: 'idle' | 'sending' | 'sent' | 'error';
  errorMessage?: string;
}

export const EmailSender: React.FC<EmailSenderProps> = ({ adminId, studentsList }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [recipientType, setRecipientType] = useState<'student' | 'parent'>('student');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [templates, setTemplates] = useState<Record<string, string>>({});
  
  // Bulk sending states
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkList, setBulkList] = useState<BulkSendItem[]>([]);
  const [bulkSending, setBulkSending] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch templates once
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await client.api.admin.templates.$get({ query: { admin_id: adminId } });
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || {});
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTemplates();
  }, [adminId]);

  // Handle student selection change (Generate draft)
  useEffect(() => {
    if (isBulkMode || !selectedStudentId) {
      setSubject('');
      setBody('');
      setToEmail('');
      return;
    }

    const student = studentsList.find(s => s.student_id === selectedStudentId);
    if (!student) return;

    if (recipientType === 'student') {
      setToEmail(`${student.student_id}@jec.ac.jp`);
    } else {
      setToEmail(student.parent_email || '');
    }

    generateDraft(student);
  }, [selectedStudentId, recipientType, templates, isBulkMode]);

  // Set up bulk list when bulk mode is enabled
  useEffect(() => {
    if (!isBulkMode) return;

    const uncompletedStudents = studentsList.filter(s => s.is_completed === 0);
    
    const prepareBulkList = async () => {
      setLoading(true);
      const items: BulkSendItem[] = [];
      for (const s of uncompletedStudents) {
        const email = `${s.student_id}@jec.ac.jp`; // Bulk is student-only
        const draft = await getDraftContent(s, 'student');
        items.push({
          id: s.student_id,
          name: s.student_name,
          email,
          subject: draft.subject,
          body: draft.body,
          status: 'idle',
        });
      }
      setBulkList(items);
      setLoading(false);
    };

    prepareBulkList();
  }, [isBulkMode, studentsList, templates]);

  const getDraftContent = async (student: StudentStat, type: 'student' | 'parent') => {
    let activeListStr = '';
    let offerListStr = '';
    let closedListStr = '';
    let activeCount = 0;
    let offerCount = 0;

    try {
      const res = await client.api.cards.$get({ query: { student_id: student.student_id } });
      if (res.ok) {
        const cards = (await res.json()) as any;
        const activeCards = cards['選考中'] || [];
        const offerCards = cards['内定'] || [];
        const closedCards = cards['終了'] || [];

        activeCount = activeCards.length;
        offerCount = offerCards.length;

        activeListStr = activeCards.map((c: ApplicationCard) => 
          `- ${c.company_name}${c.job_title ? ` (${c.job_title})` : ''}: ${c.current_step}${c.memo ? ` (${c.memo})` : ''}`
        ).join('\n') || 'なし';

        offerListStr = offerCards.map((c: ApplicationCard) => 
          `- ${c.company_name}${c.job_title ? ` (${c.job_title})` : ''}`
        ).join('\n') || 'なし';

        closedListStr = closedCards.map((c: ApplicationCard) => 
          `- ${c.company_name}${c.job_title ? ` (${c.job_title})` : ''}`
        ).join('\n') || 'なし';
      }
    } catch (err) {
      console.error(err);
    }

    const vars: Record<string, string> = {
      name: student.student_name,
      id: student.student_id,
      date: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      active_count: activeCount.toString(),
      offer_count: offerCount.toString(),
      active_list: activeListStr,
      offer_list: offerListStr,
      closed_list: closedListStr,
    };

    let subjectTpl = '';
    let bodyTpl = '';

    if (type === 'student') {
      subjectTpl = templates['tplStudentSubject'] || '';
      bodyTpl = templates['tplStudentBody'] || '';
    } else {
      // Parent branching logic based on active_count
      if (activeCount === 0) {
        subjectTpl = templates['tplParent0Subject'] || '';
        bodyTpl = templates['tplParent0Body'] || '';
      } else if (activeCount <= 2) {
        subjectTpl = templates['tplParent1Subject'] || '';
        bodyTpl = templates['tplParent1Body'] || '';
      } else {
        subjectTpl = templates['tplParent3Subject'] || '';
        bodyTpl = templates['tplParent3Body'] || '';
      }
    }

    const parse = (tpl: string) => tpl.replace(/{(\w+)}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);

    return {
      subject: parse(subjectTpl),
      body: parse(bodyTpl),
    };
  };

  const generateDraft = async (student: StudentStat) => {
    setLoading(true);
    const draft = await getDraftContent(student, recipientType);
    setSubject(draft.subject);
    setBody(draft.body);
    setLoading(false);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail || !subject || !body) return;

    setSending(true);
    setSendResult(null);

    try {
      const res = await client.api.admin['send-email'].$post({
        query: { admin_id: adminId },
        json: { to: toEmail, subject, body },
      });

      if (res.ok) {
        const data = await res.json();
        setSendResult({
          success: true,
          message: (data as any).mocked 
            ? 'メール送信をシミュレートしました（GAS_EMAIL_URL未設定のためログに出力しました）' 
            : 'メールを送信しました',
        });
      } else {
        setSendResult({ success: false, message: 'メールの送信に失敗しました。' });
      }
    } catch (err) {
      console.error(err);
      setSendResult({ success: false, message: '通信エラーが発生しました。' });
    } finally {
      setSending(false);
    }
  };

  // Run Bulk Sending
  const runBulkSending = async () => {
    if (bulkSending) return;
    setBulkSending(true);

    for (let i = 0; i < bulkList.length; i++) {
      const item = bulkList[i];
      setBulkList(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'sending' } : b));

      try {
        const res = await client.api.admin['send-email'].$post({
          query: { admin_id: adminId },
          json: { to: item.email, subject: item.subject, body: item.body },
        });

        if (res.ok) {
          setBulkList(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'sent' } : b));
        } else {
          setBulkList(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'error', errorMessage: 'HTTPエラー' } : b));
        }
      } catch (err: any) {
        setBulkList(prev => prev.map((b, idx) => idx === i ? { ...b, status: 'error', errorMessage: err.message || '通信エラー' } : b));
      }
      
      // Add a slight delay between calls to not overload GAS Webhook
      await new Promise(r => setTimeout(r, 800));
    }

    setBulkSending(false);
    alert('一括送信処理が完了しました。');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Tab select mode */}
      <div className="flex gap-16 mb-24">
        <button
          className={`btn ${!isBulkMode ? 'btn-primary' : ''}`}
          onClick={() => {
            setIsBulkMode(false);
            setSelectedStudentId('');
          }}
        >
          個別送信
        </button>
        <button
          className={`btn ${isBulkMode ? 'btn-primary' : ''}`}
          onClick={() => setIsBulkMode(true)}
        >
          就活未完了者全員に一括送信
        </button>
      </div>

      {!isBulkMode ? (
        /* Individual Mode */
        <div className="card">
          <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="select_student">対象の学生</label>
                <select
                  id="select_student"
                  className="form-control"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={loading || sending}
                >
                  <option value="">学生を選択してください</option>
                  {studentsList.map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.student_name} ({s.student_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="select_recipient">送信先</label>
                <select
                  id="select_recipient"
                  className="form-control"
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value as any)}
                  disabled={loading || sending || !selectedStudentId}
                >
                  <option value="student">学生本人宛</option>
                  <option value="parent">保護者宛</option>
                </select>
              </div>
            </div>

            {selectedStudentId && (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="to_email">宛先メールアドレス</label>
                  <input
                    id="to_email"
                    type="email"
                    className="form-control"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    disabled={sending || recipientType === 'student'} // Lock student email as it is user@example.invalid
                    required
                  />
                  {recipientType === 'parent' && !toEmail && (
                    <p style={{ color: '#991B1B', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> 保護者のメールアドレスが登録されていません。
                    </p>
                  )}
                </div>

                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Loader className="spin" size={16} /> Draft 生成中...
                  </div>
                ) : (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="email_subject">件名</label>
                      <input
                        id="email_subject"
                        type="text"
                        className="form-control"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={sending}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="email_body">本文</label>
                      <textarea
                        id="email_body"
                        className="form-control"
                        rows={10}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={sending}
                        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
                        required
                      />
                    </div>
                  </>
                )}

                {sendResult && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: sendResult.success ? '#ECFDF5' : '#FEF2F2',
                    color: sendResult.success ? '#065F46' : '#991B1B',
                    padding: '12px',
                    borderRadius: 'var(--radius-base)',
                    fontSize: '0.875rem'
                  }}>
                    {sendResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    <span>{sendResult.message}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sending || loading || !toEmail || !subject || !body}
                    style={{ padding: '12px 24px' }}
                  >
                    {sending ? '送信中...' : (
                      <>
                        <Send size={16} />
                        <span>メールを送信する</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : (
        /* Bulk Mode */
        <div className="card">
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} />
              未完了学生全員 ({bulkList.length}名) への一括状況確認メール
            </h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>
              現在、就活完了フラグが未完了(0)の全学生に対し、個別の持ち駒数に応じて自動で下書きを生成し送信します。
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <Loader className="spin" size={24} />
              <p style={{ marginTop: '8px' }}>下書きを生成しています...</p>
            </div>
          ) : (
            <>
              {bulkList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  就活未完了の学生はいません。
                </div>
              ) : (
                <>
                  <div style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-base)',
                    marginBottom: '24px'
                  }}>
                    {bulkList.map((item, idx) => (
                      <div key={item.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: idx === bulkList.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                        backgroundColor: item.status === 'sent' ? '#F0FDF4' : item.status === 'error' ? '#FEF2F2' : 'transparent'
                      }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.name} ({item.id})</div>
                          <div className="text-tertiary" style={{ fontSize: '0.75rem' }}>{item.email}</div>
                        </div>
                        <div>
                          {item.status === 'idle' && <span className="badge badge-gray">準備完了</span>}
                          {item.status === 'sending' && (
                            <span className="badge badge-teal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Loader className="spin" size={12} /> 送信中
                            </span>
                          )}
                          {item.status === 'sent' && (
                            <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={12} /> 送信済
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="badge badge-red" title={item.errorMessage}>
                              エラー: {item.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={runBulkSending}
                      disabled={bulkSending || bulkList.length === 0}
                      style={{ padding: '12px 24px' }}
                    >
                      {bulkSending ? '送信実行中...' : (
                        <>
                          <Play size={16} />
                          <span>一括送信を実行する</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
