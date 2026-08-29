#include <algorithm>
#include <array>
#include <iostream>
#include <iterator>

enum class StageState {
    ready,
    failed,
};

int main() {
    const std::array states{
        StageState::ready,
        StageState::ready,
        StageState::failed,
        StageState::ready,
    };

    const auto failed = std::find(states.begin(), states.end(), StageState::failed);
    if (failed != states.end()) {
        std::cout << "failed-at=" << std::distance(states.begin(), failed) << '\n';
    }
}
