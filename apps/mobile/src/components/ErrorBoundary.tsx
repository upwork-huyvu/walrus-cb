import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Bắt lỗi render của screen con → tránh trắng màn toàn app (audit M-1).
type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(e: unknown): State {
    return { hasError: true, message: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(_error: unknown) {
    // TODO: gửi về crash reporter (Sentry/Crashlytics) khi tích hợp.
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Đã có lỗi xảy ra</Text>
        <Text style={styles.msg}>{this.state.message}</Text>
        <Pressable onPress={this.reset} style={styles.btn}>
          <Text style={styles.btnText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#0d1b2a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  msg: { color: '#9fb0c0', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#1f6feb', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '600' },
});
