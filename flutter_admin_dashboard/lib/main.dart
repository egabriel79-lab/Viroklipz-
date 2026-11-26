import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'models/admin_models.dart';
import 'screens/admin_login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/moderation_screen.dart';
import 'screens/user_management_screen.dart';
import 'services/admin_firestore_service.dart';
import 'theme/admin_theme.dart';
import 'widgets/admin_layout.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const ViroklipzAdminApp());
}

class ViroklipzAdminApp extends StatelessWidget {
  const ViroklipzAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Viroklipz Admin Dashboard',
      debugShowCheckedModeBanner: false,
      theme: AdminTheme.darkTheme,
      home: const _AdminAuthGate(),
    );
  }
}

class _AdminAuthGate extends StatefulWidget {
  const _AdminAuthGate();

  @override
  State<_AdminAuthGate> createState() => _AdminAuthGateState();
}

class _AdminAuthGateState extends State<_AdminAuthGate> {
  AdminUserModel? _verifiedAdmin;
  bool _checkingSession = true;
  String? _authError;

  @override
  void initState() {
    super.initState();
    _restoreExistingSession();
  }

  Future<void> _restoreExistingSession() async {
    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) {
      if (mounted) setState(() => _checkingSession = false);
      return;
    }

    try {
      final admin =
          await AdminFirestoreService.instance.verifyUserIsAdmin(currentUser);
      if (!mounted) return;
      setState(() {
        _verifiedAdmin = admin;
        _checkingSession = false;
      });
    } on AdminAccessDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _verifiedAdmin = null;
        _authError = e.message;
        _checkingSession = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _verifiedAdmin = null;
        _checkingSession = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingSession) {
      return const Scaffold(
        backgroundColor: AdminColors.background,
        body: Center(
          child: CircularProgressIndicator(color: AdminColors.magenta),
        ),
      );
    }

    if (_verifiedAdmin == null) {
      return AdminLoginScreen(
        initialError: _authError,
        onAuthenticated: (admin) {
          setState(() {
            _verifiedAdmin = admin;
            _authError = null;
          });
        },
      );
    }

    return _AdminWorkspaceShell(
      adminUser: _verifiedAdmin!,
      onSignOut: () async {
        await AdminFirestoreService.instance.signOut();
        if (!mounted) return;
        setState(() => _verifiedAdmin = null);
      },
    );
  }
}

class _AdminWorkspaceShell extends StatefulWidget {
  final AdminUserModel adminUser;
  final VoidCallback onSignOut;

  const _AdminWorkspaceShell({
    required this.adminUser,
    required this.onSignOut,
  });

  @override
  State<_AdminWorkspaceShell> createState() => _AdminWorkspaceShellState();
}

class _AdminWorkspaceShellState extends State<_AdminWorkspaceShell> {
  AdminSection _currentSection = AdminSection.dashboard;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final service = AdminFirestoreService.instance;

    return StreamBuilder<List<AdminUserModel>>(
      stream: service.watchUsers(),
      builder: (context, usersSnap) {
        final users = usersSnap.data ?? const <AdminUserModel>[];

        return StreamBuilder<List<AdminClipModel>>(
          stream: service.watchClips(),
          builder: (context, clipsSnap) {
            final clips = clipsSnap.data ?? const <AdminClipModel>[];

            return StreamBuilder<List<AdminReportModel>>(
              stream: service.watchReports(),
              builder: (context, reportsSnap) {
                final reports = reportsSnap.data ?? const <AdminReportModel>[];

                return StreamBuilder<List<AdminLiveModel>>(
                  stream: service.watchActiveLives(),
                  builder: (context, livesSnap) {
                    final lives = livesSnap.data ?? const <AdminLiveModel>[];

                    return AdminLayout(
                      adminUser: widget.adminUser,
                      currentSection: _currentSection,
                      onSelectSection: (section) =>
                          setState(() => _currentSection = section),
                      searchController: _searchController,
                      onSearchChanged: (value) =>
                          setState(() => _searchQuery = value),
                      pendingReportsCount: reports.length,
                      onSignOut: widget.onSignOut,
                      body: _buildSectionBody(
                        users: users,
                        clips: clips,
                        reports: reports,
                        lives: lives,
                      ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildSectionBody({
    required List<AdminUserModel> users,
    required List<AdminClipModel> clips,
    required List<AdminReportModel> reports,
    required List<AdminLiveModel> lives,
  }) {
    switch (_currentSection) {
      case AdminSection.dashboard:
        return DashboardScreen(
          users: users,
          clips: clips,
          reports: reports,
          activeLives: lives,
          searchQuery: _searchQuery,
        );
      case AdminSection.users:
        return UserManagementScreen(
          users: users,
          searchQuery: _searchQuery,
        );
      case AdminSection.moderation:
        return ModerationScreen(
          reports: reports,
          clips: clips,
          searchQuery: _searchQuery,
        );
    }
  }
}
