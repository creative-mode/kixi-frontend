/** Shapes returned by the backend for the student's own profile and academic context.
 *  Mirrors MeResponse, EnrollRequest/Response and the academic list DTOs. Note the
 *  mixed casing: the backend annotates some record components with @JsonProperty
 *  (snake_case) and leaves the rest camelCase. Do not "fix" the inconsistency. */

export interface SchoolInfo {
  id: number;
  code: string;
  name: string;
}

export interface CourseInfo {
  id: number;
  code: string;
  name: string;
}

export interface ClassInfo {
  id: number;
  code: string;
  grade: number | null;
  school_year_id: number | null;
  school_year: string | null;
}

/** GET /me — identity plus the resolved academic context. `course` and `currentClass`
 *  stay null until an enrollment exists; `school` comes from the institution links
 *  an administrator sets, so it can be null even for an enrolled student. */
export interface Me {
  accountId: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  roles: string[];
  school: SchoolInfo | null;
  course: CourseInfo | null;
  currentClass: ClassInfo | null;
}

/** PUT /me — every field optional; the backend applies only what is present. */
export interface MeUpdate {
  first_name?: string;
  last_name?: string;
  photo?: string;
}

export interface Institution {
  id: number;
  code: string;
  name: string;
  short_name: string | null;
  logo: string | null;
}

export interface Course {
  id: number;
  /** Opaque reference to the school. The backend deliberately does not nest the
   *  institution here, so the name has to come from the /institutions list. */
  institutionId: number;
  code: string;
  name: string;
  description: string | null;
}

export interface SchoolYear {
  id: number;
  startYear: number;
  endYear: number;
}

/** GET /classes — the backend resolves the course and school year of each class and
 *  substitutes empty objects for missing rows, so the nested ids can be null. */
export interface Class {
  id: number;
  code: string;
  grade: number | null;
  course: Partial<Course> | null;
  schoolYear: Partial<SchoolYear> | null;
  /** Always the course's school: the backend enforces it with a composite key. */
  institutionId: number;
}

export interface Enrollment {
  id: number;
  accountId: number;
  classId: number;
  schoolYearId: number;
  status: 'ACTIVE' | 'CANCELLED';
}

/** RFC 9457 problem details, as produced by the backend's GlobalExceptionHandler. */
export interface Problem {
  status: number;
  title?: string;
  detail?: string;
  properties?: Record<string, unknown>;
}
