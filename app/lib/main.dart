import 'package:flutter/material.dart';

import 'ui/now/now_screen.dart';

void main() => runApp(const ContxtApp());

class ContxtApp extends StatelessWidget {
  const ContxtApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Contxt',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF3A6EA5),
        useMaterial3: true,
      ),
      home: const NowScreen(),
    );
  }
}
