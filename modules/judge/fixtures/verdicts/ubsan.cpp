#include <climits>
#include <iostream>

int main() {
#if defined(__has_feature)
#if __has_feature(undefined_behavior_sanitizer)
    volatile int largest = INT_MAX;
    std::cout << largest + 1 << '\n';
#else
    std::cout << "ok\n";
#endif
#else
    std::cout << "ok\n";
#endif
    return 0;
}
