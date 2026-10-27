import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Mail,
  Phone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/types';
import FaceCapture from '@/components/FaceCapture';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('full_name');
    if (error) console.error('loadStudents:', error);
    if (data) setStudents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || s.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student? All attendance records will also be removed.'))
      return;
    await supabase.from('students').delete().eq('id', id);
    loadStudents();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Student Directory</h3>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} students enrolled in ICT12
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-md shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or student number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Loading students...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No students found.</p>
            <button
              onClick={handleAdd}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700"
            >
              Add First Student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Number</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Section</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {student.photo_url ? (
                            <img
                              src={student.photo_url}
                              alt={student.full_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-brand-700">
                              {student.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {student.full_name}
                          </p>
                          {student.email && (
                            <p className="text-xs text-gray-400">{student.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {student.student_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.gender}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
                        {student.section}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {student.phone || '--'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          student.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="p-2 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <StudentModal
          student={editingStudent}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadStudents();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Student Modal — includes face capture, landmarks, and upload        */
/* ------------------------------------------------------------------ */

function StudentModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    student_number: student?.student_number ?? '',
    full_name: student?.full_name ?? '',
    gender: student?.gender ?? 'Male',
    section: student?.section ?? 'ICT12',
    email: student?.email ?? '',
    phone: student?.phone ?? '',
    status: student?.status ?? 'active',
  });

  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [faceLandmarks, setFaceLandmarks] = useState<any | null>(null);
  const [faceRemoved, setFaceRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFaceChange = (
    blob: Blob | null,
    previewUrl: string | null,
    landmarks: any | null
  ) => {
    setFaceBlob(blob);
    setFaceLandmarks(landmarks ?? null);
    setFaceRemoved(!blob && !previewUrl && !!student?.photo_url);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    if (!form.student_number.trim() || !form.full_name.trim()) {
      setError('Student number and full name are required.');
      setSaving(false);
      return;
    }

    try {
      let photoUrl: string | null = student?.photo_url ?? null;
      // Keep whatever is already stored unless we're replacing it
      let landmarksToSave: any | null =
        (student as any)?.face_landmarks ?? null;

      if (faceBlob) {
        const ext = faceBlob.type === 'image/png' ? 'png' : 'jpg';
        const safe = form.student_number.replace(/[^a-zA-Z0-9_-]/g, '_');
        const path = `${safe}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('student-photos')
          .upload(path, faceBlob, { contentType: faceBlob.type, upsert: false });

        if (uploadErr) {
          throw new Error(`Photo upload failed: ${uploadErr.message}`);
        }

        const { data } = supabase.storage
          .from('student-photos')
          .getPublicUrl(path);
        photoUrl = data.publicUrl;
        landmarksToSave = faceLandmarks;
      } else if (faceRemoved) {
        photoUrl = null;
        landmarksToSave = null;
      }

      const payload = {
        ...form,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        photo_url: photoUrl,
        face_landmarks: landmarksToSave,
      };

      if (student) {
        const { error: dbErr } = await supabase
          .from('students')
          .update(payload)
          .eq('id', student.id);
        if (dbErr) throw new Error(`Update failed: ${dbErr.message}`);
      } else {
        const { error: dbErr } = await supabase
          .from('students')
          .insert(payload);
        if (dbErr) throw new Error(`Insert failed: ${dbErr.message}`);
      }

      onSaved();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {student ? 'Edit Student' : 'Add New Student'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
            {/* Face panel — now passes landmarks back via 3rd arg */}
            <FaceCapture
              initialUrl={student?.photo_url ?? null}
              onChange={handleFaceChange}
            />

            {/* Fields */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Student Number" required>
                <input
                  type="text"
                  value={form.student_number}
                  onChange={(e) =>
                    setForm({ ...form, student_number: e.target.value })
                  }
                  className="input"
                  placeholder="2026-001"
                />
              </Field>
              <Field label="Full Name" required>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  className="input"
                  placeholder="Juan Dela Cruz"
                />
              </Field>
              <Field label="Gender">
                <select
                  value={form.gender}
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value })
                  }
                  className="input"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
              <Field label="Section">
                <input
                  type="text"
                  value={form.section}
                  onChange={(e) =>
                    setForm({ ...form, section: e.target.value })
                  }
                  className="input"
                />
              </Field>
              <Field label="Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="input pl-10"
                    placeholder="student@school.edu"
                  />
                </div>
              </Field>
              <Field label="Phone">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="input pl-10"
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                  className="input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : student ? 'Update Student' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}