import 'package:cloud_firestore/cloud_firestore.dart';

DateTime _parseTimestamp(dynamic value) {
  if (value is Timestamp) return value.toDate();
  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
  if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
  return DateTime.now();
}

int _parseInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

class AdminUserModel {
  final String uid;
  final String username;
  final String displayName;
  final String email;
  final String avatarUrl;
  final String country;
  final int coins;
  final int followersCount;
  final int fanLevel;
  final bool isAdmin;
  final bool isBanned;
  final bool isPublic;
  final DateTime createdAt;

  const AdminUserModel({
    required this.uid,
    required this.username,
    required this.displayName,
    required this.email,
    required this.avatarUrl,
    required this.country,
    required this.coins,
    required this.followersCount,
    required this.fanLevel,
    required this.isAdmin,
    required this.isBanned,
    required this.isPublic,
    required this.createdAt,
  });

  factory AdminUserModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final username = (data['username'] ?? 'creador').toString();
    final rawEmail = (data['email'] ?? '').toString().trim();
    final rawCountry = (data['country'] ?? '').toString().trim();
    final suspended = data['isBanned'] == true || data['banned'] == true;

    return AdminUserModel(
      uid: (data['uid'] ?? doc.id).toString(),
      username: username,
      displayName: (data['displayName'] ?? username).toString(),
      email: rawEmail.isNotEmpty ? rawEmail : '$username@viroklipz.app',
      avatarUrl: (data['avatarUrl'] ?? '').toString(),
      country: rawCountry.isNotEmpty ? rawCountry : 'Sin especificar',
      coins: _parseInt(data['coins'], 0),
      followersCount: _parseInt(data['followersCount'], 0),
      fanLevel: _parseInt(data['fanLevel'], 1),
      isAdmin: data['isAdmin'] == true,
      isBanned: suspended,
      isPublic: data['isPublic'] != false,
      createdAt: _parseTimestamp(data['createdAt']),
    );
  }
}

class AdminClipModel {
  final String id;
  final String authorId;
  final String authorUsername;
  final String authorDisplayName;
  final String caption;
  final String category;
  final String videoUrl;
  final String visualPreset;
  final int likesCount;
  final int viewsCount;
  final DateTime createdAt;

  const AdminClipModel({
    required this.id,
    required this.authorId,
    required this.authorUsername,
    required this.authorDisplayName,
    required this.caption,
    required this.category,
    required this.videoUrl,
    required this.visualPreset,
    required this.likesCount,
    required this.viewsCount,
    required this.createdAt,
  });

  factory AdminClipModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return AdminClipModel(
      id: (data['id'] ?? doc.id).toString(),
      authorId: (data['authorId'] ?? '').toString(),
      authorUsername: (data['authorUsername'] ?? 'creador').toString(),
      authorDisplayName: (data['authorDisplayName'] ?? 'Creador').toString(),
      caption: (data['caption'] ?? '').toString(),
      category: (data['category'] ?? 'general').toString(),
      videoUrl: (data['videoUrl'] ?? '').toString(),
      visualPreset: (data['visualPreset'] ?? '').toString(),
      likesCount: _parseInt(data['likesCount'], 0),
      viewsCount: _parseInt(data['viewsCount'], 0),
      createdAt: _parseTimestamp(data['createdAt']),
    );
  }
}

class AdminReportModel {
  final String id;
  final String reporterId;
  final String targetType;
  final String targetId;
  final String videoId;
  final String targetAuthorId;
  final String reason;
  final String details;
  final String status;
  final DateTime createdAt;

  const AdminReportModel({
    required this.id,
    required this.reporterId,
    required this.targetType,
    required this.targetId,
    required this.videoId,
    required this.targetAuthorId,
    required this.reason,
    required this.details,
    required this.status,
    required this.createdAt,
  });

  String get effectiveVideoId =>
      videoId.isNotEmpty ? videoId : (targetId.isNotEmpty ? targetId : id);

  factory AdminReportModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return AdminReportModel(
      id: (data['id'] ?? doc.id).toString(),
      reporterId: (data['reporterId'] ?? '').toString(),
      targetType: (data['targetType'] ?? 'clip').toString(),
      targetId: (data['targetId'] ?? '').toString(),
      videoId: (data['videoId'] ?? '').toString(),
      targetAuthorId: (data['targetAuthorId'] ?? '').toString(),
      reason: (data['reason'] ?? 'contenido_inapropiado').toString(),
      details: (data['details'] ?? '').toString(),
      status: (data['status'] ?? 'pending').toString(),
      createdAt: _parseTimestamp(data['createdAt']),
    );
  }
}

class AdminLiveModel {
  final String id;
  final String hostUid;
  final String hostUsername;
  final String hostDisplayName;
  final String title;
  final int viewerCount;
  final int giftsCount;
  final String status;

  const AdminLiveModel({
    required this.id,
    required this.hostUid,
    required this.hostUsername,
    required this.hostDisplayName,
    required this.title,
    required this.viewerCount,
    required this.giftsCount,
    required this.status,
  });

  factory AdminLiveModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return AdminLiveModel(
      id: (data['id'] ?? doc.id).toString(),
      hostUid: (data['hostUid'] ?? '').toString(),
      hostUsername: (data['hostUsername'] ?? 'creador').toString(),
      hostDisplayName: (data['hostDisplayName'] ?? 'Creador').toString(),
      title: (data['title'] ?? 'En vivo').toString(),
      viewerCount: _parseInt(data['viewerCount'], 1),
      giftsCount: _parseInt(data['giftsCount'], 0),
      status: (data['status'] ?? 'ended').toString(),
    );
  }
}
