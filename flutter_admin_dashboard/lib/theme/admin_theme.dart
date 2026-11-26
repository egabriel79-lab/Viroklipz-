import 'package:flutter/material.dart';

class AdminColors {
  static const Color background = Color(0xFF070A14);
  static const Color sidebar = Color(0xFF0B0F1E);
  static const Color surface = Color(0xFF10162A);
  static const Color surfaceElevated = Color(0xFF171F3A);
  static const Color border = Color(0xFF242E4F);

  static const Color magenta = Color(0xFFE84393);
  static const Color electricBlue = Color(0xFF00B4D8);
  static const Color royalBlue = Color(0xFF3B82F6);
  static const Color purple = Color(0xFF6C5CE7);
  static const Color violet = Color(0xFF8B5CF6);

  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);

  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
}

class AdminTheme {
  static ThemeData get darkTheme {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AdminColors.background,
      colorScheme: const ColorScheme.dark(
        primary: AdminColors.magenta,
        secondary: AdminColors.electricBlue,
        surface: AdminColors.surface,
        error: AdminColors.danger,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: AdminColors.textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AdminColors.sidebar,
        foregroundColor: AdminColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      cardTheme: CardThemeData(
        color: AdminColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AdminColors.border, width: 1),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AdminColors.border,
        thickness: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AdminColors.background,
        hintStyle: const TextStyle(color: AdminColors.textMuted, fontSize: 13),
        labelStyle:
            const TextStyle(color: AdminColors.textSecondary, fontSize: 13),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AdminColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AdminColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              const BorderSide(color: AdminColors.electricBlue, width: 1.5),
        ),
      ),
      dataTableTheme: DataTableThemeData(
        headingRowColor: WidgetStateProperty.all(AdminColors.surfaceElevated),
        headingTextStyle: const TextStyle(
          color: AdminColors.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
        dataTextStyle: const TextStyle(
          color: AdminColors.textPrimary,
          fontSize: 13,
        ),
        dividerThickness: 0.7,
      ),
    );
  }
}
