import fs from "fs";
import path from "path";
import { hasPermission } from "./rbac";

describe("Phase 63: Mute All & Kill Video for Privacy (Pardah Master Switch)", () => {
  describe("1. Schema & Service Layer Verification in liveClasses.ts", () => {
    const liveClassesSource = fs.readFileSync(path.join(__dirname, "liveClasses.ts"), "utf8");

    it("defines privacy master properties on LiveClass type", () => {
      expect(liveClassesSource).toContain("audio_muted_all?: boolean;");
      expect(liveClassesSource).toContain("camera_disabled_all?: boolean;");
      expect(liveClassesSource).toContain("privacy_shield_active?: boolean;");
      expect(liveClassesSource).toContain("privacy_updated_at_ms?: number;");
    });

    it("exports teacher/admin privacy management functions", () => {
      expect(liveClassesSource).toContain("export async function muteAllStudents(");
      expect(liveClassesSource).toContain("export async function unmuteAllStudents(");
      expect(liveClassesSource).toContain("export async function killAllVideo(");
      expect(liveClassesSource).toContain("export async function toggleEmergencyPrivacyShield(");
    });

    it("enforces RBAC role check before modifying privacy master state", () => {
      expect(liveClassesSource).toContain("verifyTeacherOrAdmin(profile, 'mute all students');");
      expect(liveClassesSource).toContain("verifyTeacherOrAdmin(profile, 'unmute all students');");
      expect(liveClassesSource).toContain("verifyTeacherOrAdmin(profile, 'toggle video privacy');");
      expect(liveClassesSource).toContain("verifyTeacherOrAdmin(profile, 'toggle emergency privacy shield');");
    });

    it("clears active speaker and resets speaking students when muteAll or emergencyShield is called", () => {
      expect(liveClassesSource).toContain("active_speaker_name: ''");
      expect(liveClassesSource).toContain("active_speaker_uid: ''");
      expect(liveClassesSource).toContain("status: item.status === 'speaking' ? ('waiting' as const) : item.status");
    });
  });

  describe("2. UI & Enforcement Layer in live-class/[id].tsx", () => {
    const screenSource = fs.readFileSync(path.join(__dirname, "../app/live-class/[id].tsx"), "utf8");

    it("imports privacy master functions from liveClasses", () => {
      expect(screenSource).toContain("muteAllStudents");
      expect(screenSource).toContain("unmuteAllStudents");
      expect(screenSource).toContain("killAllVideo");
      expect(screenSource).toContain("toggleEmergencyPrivacyShield");
    });

    it("renders Teacher Privacy Master Toolbar with Mute All and Kill Video actions", () => {
      expect(screenSource).toContain("حجاب و صوتی کنٹرول • Privacy & Mic Master Switch");
      expect(screenSource).toContain("Mute All (سب خاموش)");
      expect(screenSource).toContain("Kill Video (پردہ)");
      expect(screenSource).toContain("Emergency Privacy Shield (ہنگامی پردہ)");
    });

    it("renders Emergency Privacy Shield banner with Islamic lockdown notice", () => {
      expect(screenSource).toContain("ہنگامی پردہ شیلڈ • Emergency Shield Active");
      expect(screenSource).toContain("Ustaadha has initiated an instant privacy lockdown.");
    });

    it("enforces student mic mute reactively when audio_muted_all or privacy_shield_active is true", () => {
      expect(screenSource).toContain("if (liveClass.audio_muted_all || liveClass.privacy_shield_active) {");
      expect(screenSource).toContain("setMicMuted(true);");
    });

    it("locks student mic button and blocks external video bridge when privacy lockdown is active", () => {
      expect(screenSource).toContain("Microphone locked by Ustaadha (Mute All active)");
      expect(screenSource).toContain("Video Bridge Locked (Pardah Mode)");
      expect(screenSource).toContain("Video Bridge Disabled 📷🚫");
    });
  });

  describe("3. Islamic Permission & Role Access Verification", () => {
    const teacherProfile = { name: "Ustaadha Sumra Fatma", email: "teacher@mslb.edu", role: "teacher" as const, status: "approved" as const };
    const superAdminProfile = { name: "Super Admin Sister", email: "super@mslb.edu", role: "super_admin" as const, status: "approved" as const };
    const studentProfile = { name: "Taliba Zainab", email: "student@mslb.edu", role: "student" as const, status: "approved" as const };

    it("allows teacher and super_admin to manage classroom", () => {
      expect(hasPermission(teacherProfile, "teacher.class.manage")).toBe(true);
      expect(hasPermission(superAdminProfile, "teacher.class.manage")).toBe(true);
    });

    it("strictly forbids student from accessing administrative classroom tools", () => {
      expect(hasPermission(studentProfile, "teacher.class.manage")).toBe(false);
      expect(hasPermission(studentProfile, "admin.users.manage")).toBe(false);
    });
  });
});