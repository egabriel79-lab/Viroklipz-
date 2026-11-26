import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../services/admin_firestore_service.dart';
import '../theme/admin_theme.dart';

class AdminLoginScreen extends StatefulWidget {
  final ValueChanged<AdminUserModel> onAuthenticated;
  final String? initialError;

  const AdminLoginScreen({
    super.key,
    required this.onAuthenticated,
    this.initialError,
  });

  @override
  State<AdminLoginScreen> createState() => _AdminLoginScreenState();
}

class _AdminLoginScreenState extends State<AdminLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _errorMessage = widget.initialError;
  }

  @override
  void didUpdateWidget(covariant AdminLoginScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialError != null &&
        widget.initialError != oldWidget.initialError) {
      _errorMessage = widget.initialError;
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final adminProfile = await AdminFirestoreService.instance.signInAdmin(
        email: _emailController.text,
        password: _passwordController.text,
      );
      if (!mounted) return;
      widget.onAuthenticated(adminProfile);
    } on AdminAccessDeniedException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AdminColors.danger,
        ),
      );
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = _mapAuthError(e.code));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'No se pudo iniciar sesión: $e';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _mapAuthError(String code) {
    switch (code) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
        return 'Credenciales inválidas. Verifica tu correo y contraseña.';
      case 'invalid-email':
        return 'El formato del correo electrónico no es válido.';
      case 'user-disabled':
        return 'Esta cuenta ha sido deshabilitada en Firebase Authentication.';
      case 'too-many-requests':
        return 'Demasiados intentos fallidos. Espera unos minutos.';
      default:
        return 'Error de autenticación ($code).';
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 920;

    return Scaffold(
      backgroundColor: AdminColors.background,
      body: isDesktop
          ? Row(
              children: [
                const Expanded(flex: 5, child: _BrandShowcasePanel()),
                Expanded(flex: 5, child: _buildFormPanel()),
              ],
            )
          : Column(
              children: [
                const SizedBox(
                  height: 210,
                  child: _BrandShowcasePanel(compact: true),
                ),
                Expanded(child: _buildFormPanel()),
              ],
            ),
    );
  }

  Widget _buildFormPanel() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 430),
          child: Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: AdminColors.magenta.withValues(alpha: 0.28),
              ),
              boxShadow: [
                BoxShadow(
                  color: AdminColors.magenta.withValues(alpha: 0.14),
                  blurRadius: 42,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AdminColors.magenta.withValues(alpha: 0.18),
                              AdminColors.electricBlue.withValues(alpha: 0.18),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color:
                                AdminColors.electricBlue.withValues(alpha: 0.4),
                          ),
                        ),
                        child: const Text(
                          'ACCESO PRIVADO · ADMIN',
                          style: TextStyle(
                            color: AdminColors.electricBlue,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Panel Administrativo Viroklipz',
                    style: TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Ingresa con el correo autorizado Egabriel79@gmail.com.',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AdminColors.danger.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: AdminColors.danger.withValues(alpha: 0.6),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.gpp_bad_rounded,
                            color: AdminColors.danger,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: Color(0xFFFCA5A5),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  const Text(
                    'Correo',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    style: const TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 14,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Egabriel79@gmail.com',
                      prefixIcon: Icon(
                        Icons.mail_outline_rounded,
                        size: 19,
                        color: AdminColors.electricBlue,
                      ),
                    ),
                    validator: (value) {
                      final text = (value ?? '').trim();
                      if (text.isEmpty || !text.contains('@')) {
                        return 'Ingresa un correo electrónico válido.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Contraseña',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _handleLogin(),
                    style: const TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 14,
                    ),
                    decoration: InputDecoration(
                      hintText: '••••••••••••',
                      prefixIcon: const Icon(
                        Icons.lock_outline_rounded,
                        size: 19,
                        color: AdminColors.magenta,
                      ),
                      suffixIcon: IconButton(
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          size: 19,
                        ),
                      ),
                    ),
                    validator: (value) {
                      if ((value ?? '').length < 6) {
                        return 'La contraseña debe tener al menos 6 caracteres.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    height: 50,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        gradient: const LinearGradient(
                          colors: [
                            AdminColors.magenta,
                            AdminColors.purple,
                            AdminColors.electricBlue,
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AdminColors.magenta.withValues(alpha: 0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Iniciar Sesión',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandShowcasePanel extends StatelessWidget {
  final bool compact;

  const _BrandShowcasePanel({this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF070A16),
            Color(0xFF141236),
            Color(0xFF280E32),
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -80,
            left: -60,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AdminColors.electricBlue.withValues(alpha: 0.16),
              ),
            ),
          ),
          Positioned(
            bottom: -90,
            right: -40,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AdminColors.magenta.withValues(alpha: 0.22),
              ),
            ),
          ),
          Center(
            child: Padding(
              padding: EdgeInsets.all(compact ? 20 : 48),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: compact
                    ? CrossAxisAlignment.center
                    : CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: compact ? 44 : 58,
                        height: compact ? 44 : 58,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: const LinearGradient(
                            colors: [
                              AdminColors.magenta,
                              AdminColors.electricBlue,
                            ],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AdminColors.magenta.withValues(alpha: 0.45),
                              blurRadius: 24,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 34,
                        ),
                      ),
                      const SizedBox(width: 14),
                      RichText(
                        text: TextSpan(
                          style: TextStyle(
                            fontSize: compact ? 26 : 36,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.6,
                          ),
                          children: const [
                            TextSpan(
                              text: 'Viro',
                              style: TextStyle(color: Colors.white),
                            ),
                            TextSpan(
                              text: 'klipz',
                              style: TextStyle(color: AdminColors.magenta),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: compact ? 10 : 28),
                  Text(
                    'Centro de Control & Moderación',
                    textAlign: compact ? TextAlign.center : TextAlign.left,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: compact ? 18 : 30,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  if (!compact) ...[
                    const SizedBox(height: 14),
                    const Text(
                      'Administra métricas de crecimiento, cuentas de creadores, transmisiones Live activas y moderación de reportes en tiempo real con Flutter Web y Firestore.',
                      style: TextStyle(
                        color: Color(0xFFCBD5E1),
                        fontSize: 14.5,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _FeatureChip(
                          icon: Icons.verified_user_rounded,
                          label: 'Acceso Exclusivo Admin',
                        ),
                        _FeatureChip(
                          icon: Icons.analytics_rounded,
                          label: 'Métricas fl_chart',
                        ),
                        _FeatureChip(
                          icon: Icons.gavel_rounded,
                          label: 'Moderación directa',
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _FeatureChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AdminColors.electricBlue.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AdminColors.electricBlue),
          const SizedBox(width: 7),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
